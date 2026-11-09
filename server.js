'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const URL_BASE = 'https://api.prod.whoop.com';
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const CLIENT_ID = process.env.WHOOP_CLIENT_ID;
const CLIENT_SECRET = process.env.WHOOP_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const configured = !!(PUBLIC_URL && CLIENT_ID && CLIENT_SECRET && SESSION_SECRET && SESSION_SECRET.length >= 32);
const cookieKey = configured ? crypto.createHash('sha256').update(SESSION_SECRET).digest() : null;
const callback = () => PUBLIC_URL + '/api/whoop/callback';
const send = (res, status, value, headers={}) => {
  const body = JSON.stringify(value);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
};
const redirect = (res, where, cookies=[]) => {
  res.writeHead(302, {'Location':where,'Set-Cookie':cookies,'Cache-Control':'no-store'});
  res.end();
};
const secureCookie = (name, value, maxAge) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const clearCookie = name => secureCookie(name, '', 0);
const getCookie = (req, name) => (req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1);
const seal = obj => {
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',cookieKey,iv);
  const b=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),b]).toString('base64url');
};
const unseal = s => {
  try{
    const raw=Buffer.from(s,'base64url');
    const decipher=crypto.createDecipheriv('aes-256-gcm',cookieKey,raw.subarray(0,12));
    decipher.setAuthTag(raw.subarray(12,28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString());
  }catch{return null;}
};
async function tokenRequest(params){
  const response=await fetch(URL_BASE+'/oauth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params)});
  const data=await response.json();
  if(!response.ok)throw Error('WHOOP token exchange failed');
  return data;
}
function tokenState(data, previous={}) {
  return {access_token:data.access_token,refresh_token:data.refresh_token||previous.refresh_token,expires_at:Date.now()+Number(data.expires_in||1800)*1000};
}
async function apiGet(endpoint, token){
  const r=await fetch(URL_BASE+'/developer/v2/'+endpoint,{headers:{Authorization:'Bearer '+token}});
  if(!r.ok)throw Error('WHOOP request failed ('+r.status+')');
  return r.json();
}
const latest = obj => Array.isArray(obj?.records) ? obj.records[0]||null : null;
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/api/whoop/login' && req.method==='GET'){
    if(!configured)return send(res,503,{error:'WHOOP has not been configured in Render.'});
    const state=crypto.randomBytes(24).toString('base64url');
    const url=new URL(URL_BASE+'/oauth/oauth2/auth');
    url.search=new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:callback(),scope:'read:recovery read:sleep read:cycles offline',state}).toString();
    return redirect(res,url.toString(),[secureCookie('whoop_state',state,600)]);
  }
  if(pathname==='/api/whoop/callback' && req.method==='GET'){
    if(!configured)return send(res,503,{error:'WHOOP not configured'});
    const query=new URL(req.url,'http://localhost').searchParams;
    const received=query.get('state');
    const expected=getCookie(req,'whoop_state');
    if(!received||!expected||received!==expected||!query.get('code'))
      return send(res,400,{error:'WHOOP permission was cancelled or security check failed.'},{'Set-Cookie':clearCookie('whoop_state')});
    const data=await tokenRequest({grant_type:'authorization_code',code:query.get('code'),redirect_uri:callback(),client_id:CLIENT_ID,client_secret:CLIENT_SECRET});
    const token=seal(tokenState(data));
    if(token.length>3800)throw Error('Session cookie too large');
    return redirect(res,'/#whoop',[clearCookie('whoop_state'),secureCookie('reptrack_whoop',token,60*60*24*30)]);
  }
  if(pathname==='/api/whoop/logout' && req.method==='POST')
    return send(res,200,{connected:false},{'Set-Cookie':clearCookie('reptrack_whoop')});
  if(pathname==='/api/whoop/summary' && req.method==='GET'){
    if(!configured)return send(res,200,{configured:false,connected:false});
    let tokens=unseal(getCookie(req,'reptrack_whoop')||'');
    if(!tokens)return send(res,200,{configured:true,connected:false});
    let newCookie=null;
    if(Date.now()>tokens.expires_at-60000){
      if(!tokens.refresh_token)return send(res,200,{configured:true,connected:false},{'Set-Cookie':clearCookie('reptrack_whoop')});
      try{
        tokens=tokenState(await tokenRequest({grant_type:'refresh_token',refresh_token:tokens.refresh_token,client_id:CLIENT_ID,client_secret:CLIENT_SECRET}),tokens);
        newCookie=secureCookie('reptrack_whoop',seal(tokens),60*60*24*30);
      }catch{
        return send(res,200,{configured:true,connected:false},{'Set-Cookie':clearCookie('reptrack_whoop')});
      }
    }
    const results=await Promise.allSettled(['recovery?limit=1','activity/sleep?limit=1','cycle?limit=1'].map(p=>apiGet(p,tokens.access_token)));
    if(results.every(r=>r.status==='rejected'))
      return send(res,502,{error:'WHOOP did not return metrics. Check scopes and your account connection.'},newCookie?{'Set-Cookie':newCookie}:{});
    const records=results.map(r=>r.status==='fulfilled'?latest(r.value):null);
    return send(res,200,{configured:true,connected:true,recovery:records[0],sleep:records[1],cycle:records[2]},newCookie?{'Set-Cookie':newCookie}:{});
  }
  if(pathname==='/'||pathname==='/index.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return fs.createReadStream(path.join(__dirname,'index.html')).pipe(res);
  }
  return send(res,404,{error:'Not found'});
 }catch(err){
  console.error('Request error:',err.message);
  return send(res,500,{error:'An error occurred. Check your Render service logs.'});
 }
});
server.listen(PORT,'0.0.0.0',()=>console.log('RepTrack running on port',PORT));
