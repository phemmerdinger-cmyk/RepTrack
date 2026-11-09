'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const zlib = require('node:zlib');
// Native PNG app icons. No additional image dependencies required.
const iconCache = new Map();
function appIcon(size){
 if(iconCache.has(size))return iconCache.get(size);
 const w=size,h=size,pixels=Buffer.alloc((w*3+1)*h);
 const rect=(x,y,a,b)=>x>=a[0]&&x<a[2]&&y>=a[1]&&y<a[3];
 const ring=(x,y)=>rect(x,y,[26,30,102,98])&&!rect(x,y,[35,39,93,89]);
 for(let py=0;py<h;py++){
  const row=py*(w*3+1);pixels[row]=0;
  for(let px=0;px<w;px++){
   const x=(px+.5)*128/w,y=(py+.5)*128/h;
   const strap=rect(x,y,[49,7,79,31])||rect(x,y,[49,97,79,121]);
   const face=ring(x,y);
   const shaft=rect(x,y,[38,61,90,68]);
   const plates=rect(x,y,[40,50,47,79])||rect(x,y,[81,50,88,79])||rect(x,y,[31,55,37,74])||rect(x,y,[91,55,97,74]);
   const white=strap||face||shaft||plates;
   const off=row+1+px*3;
   pixels[off]=pixels[off+1]=pixels[off+2]=white?248:8;
  }
 }
 const crcTable=(()=>{let t=[];for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
 const crc=buf=>{let c=0xffffffff;for(const b of buf)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0};
 const chunk=(type,data)=>{const kind=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([kind,data])));return Buffer.concat([length,kind,data,checksum])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 const out=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(pixels,{level:9})),chunk('IEND',Buffer.alloc(0))]);
 iconCache.set(size,out);return out;
}

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
const oauthErrorPage = (res, heading, explanation, status=400) => {
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const body = '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WHOOP connection issue</title><body style="font:16px/1.6 system-ui;background:#0b1220;color:#f4f7fb;max-width:620px;margin:45px auto;padding:22px"><h1>'+esc(heading)+'</h1><p>'+esc(explanation)+'</p><p>Check that your WHOOP Client ID and Client Secret are from the same app, and that the registered redirect URI is exactly <code>https://reptrack-cwrc.onrender.com/api/whoop/callback</code>.</p><p>Do not share credentials or authorization codes in screenshots.</p><a style="color:#c6fb6d" href="/#whoop">Return to RepTrack</a></body></html>';
  res.writeHead(status, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
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
  if(pathname==='/api/whoop/status' && req.method==='GET'){
    return send(res,200,{configured,missing:[!CLIENT_ID?'WHOOP_CLIENT_ID':null,!CLIENT_SECRET?'WHOOP_CLIENT_SECRET':null,!PUBLIC_URL?'PUBLIC_URL':null,!(SESSION_SECRET&&SESSION_SECRET.length>=32)?'SESSION_SECRET':null].filter(Boolean),callback:PUBLIC_URL?callback():null});
  }
  if(pathname==='/api/whoop/login' && req.method==='GET'){
    if(!configured){
      const missing=[!CLIENT_ID?'WHOOP_CLIENT_ID':null,!CLIENT_SECRET?'WHOOP_CLIENT_SECRET':null,!PUBLIC_URL?'PUBLIC_URL':null,!(SESSION_SECRET&&SESSION_SECRET.length>=32)?'SESSION_SECRET':null].filter(Boolean);
      res.writeHead(503,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
      return res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WHOOP setup required</title><body style="font:16px/1.6 system-ui;background:#0b1220;color:#f4f7fb;max-width:620px;margin:50px auto;padding:20px"><h1>WHOOP setup is incomplete</h1><p>Before connecting, add these missing settings in Render → Environment:</p><p><strong>'+missing.join(', ')+'</strong></p><p>Save and deploy, then try again.</p><a href="/#whoop" style="color:#c6fb6d">Return to RepTrack</a></body></html>');
    }
    const state=crypto.randomBytes(24).toString('base64url');
    const url=new URL(URL_BASE+'/oauth/oauth2/auth');
    url.search=new URLSearchParams({client_id:CLIENT_ID,response_type:'code',redirect_uri:callback(),scope:'read:recovery read:sleep read:cycles offline',state}).toString();
    return redirect(res,url.toString(),[secureCookie('whoop_state',state,600)]);
  }
  if(pathname==='/api/whoop/callback' && req.method==='GET'){
    if(!configured)return send(res,503,{error:'WHOOP not configured'});
    const query=new URL(req.url,'http://localhost').searchParams;
    if(query.get('error')) {
      console.warn('WHOOP authorization denied:',String(query.get('error')).slice(0,80));
      return oauthErrorPage(res,'WHOOP authorization was not completed','WHOOP returned: '+String(query.get('error')).slice(0,80)+'. Please review your app permissions and try again.');
    }
    const received=query.get('state');
    const expected=getCookie(req,'whoop_state');
    if(!received||!expected||received!==expected||!query.get('code'))
      return oauthErrorPage(res,'WHOOP sign-in could not be verified','The secure sign-in session expired or was blocked. Open RepTrack and choose Connect WHOOP again, in the same browser.');
    let data;
    try {
      data=await tokenRequest({grant_type:'authorization_code',code:query.get('code'),redirect_uri:callback(),client_id:CLIENT_ID,client_secret:CLIENT_SECRET});
    } catch (err) {
      console.error('WHOOP authorization code exchange failed:',err.message);
      return oauthErrorPage(res,'WHOOP rejected the connection','WHOOP could not exchange the authorization code for an access token. Confirm that both credentials belong to your current WHOOP developer app and that the redirect URI is registered.',502);
    }
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
  if(req.method==='GET' && (pathname==='/icon-192.png'||pathname==='/icon-512.png')){
    const size=pathname==='/icon-192.png'?192:512;
    res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});
    return res.end(appIcon(size));
  }
  if(req.method==='GET' && (pathname==='/manifest.webmanifest'||pathname==='/sw.js')){
    const asset=pathname.slice(1);
    const mime=asset==='manifest.webmanifest'?'application/manifest+json':'text/javascript; charset=utf-8';
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Service-Worker-Allowed':'/'});
    return fs.createReadStream(path.join(__dirname,asset)).pipe(res);
  }
  if(req.method==='GET' && (pathname==='/app.css'||pathname==='/app.js'||pathname==='/favicon.svg'||pathname==='/future.css'||pathname==='/future.js'||pathname==='/analytics.css'||pathname==='/analytics.js'||pathname==='/workout.css'||pathname==='/workout.js')){
    const asset=pathname.slice(1);
    const mime=asset.endsWith('.css')?'text/css; charset=utf-8':asset.endsWith('.js')?'text/javascript; charset=utf-8':'image/svg+xml';
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'});
    return fs.createReadStream(path.join(__dirname,asset)).pipe(res);
  }
  if(pathname==='/privacy' || pathname==='/privacy.html'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    return fs.createReadStream(path.join(__dirname,'privacy.html')).pipe(res);
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
