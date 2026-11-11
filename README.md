# RepTrack

Mobile-friendly and desktop-friendly workout tracker with a WHOOP OAuth server.

## Deploy to Render

1. In Render, create a **Web Service** connected to this GitHub repository.
2. Select Node runtime, set Build Command to `npm install`, and Start Command to `npm start`.
3. Deploy and copy the Render HTTPS web address.
4. Register a developer app at https://developer.whoop.com/.
5. Set its redirect URI to `https://YOUR-RENDER-ADDRESS.onrender.com/api/whoop/callback` and request `read:recovery`, `read:sleep`, `read:cycles`, and `offline` if supported.
6. Add these Environment variables in Render:
   - `WHOOP_CLIENT_ID`: from WHOOP developer dashboard
   - `WHOOP_CLIENT_SECRET`: from WHOOP developer dashboard
   - `PUBLIC_URL`: exact site URL (no trailing slash)
   - `SESSION_SECRET`: a strong random secret at least 32 characters long
7. Save the environment variables and redeploy. Open the WHOOP tab and use Connect WHOOP.

## Important
- Never commit any OAuth client secret, access token, or session secret to GitHub.
- The WHOOP flow is included but must be tested after you configure your own credentials.
- Workout history is stored locally in each browser. Phone and desktop data do not yet automatically sync. Use the export/import backup feature.
- This is a personal-use starter app, not an independently security-audited multi-user service.
- Render's free tier may take longer to respond after periods of inactivity.

## Finding your way around

- **Calendar**: open today's workout or choose a date to plan and log sets. Phones start with a readable date list; switch to the month grid at any time.
- **Analytics**: explore exercise history, WHOOP activities, and training charts. “Read workout data as a table” provides a text alternative for saved sets.
- **Strength progress** (formerly Progressive Overload): compare individual lifts and review the existing squat plan.
- **Training plans** (formerly Experiments): configure the existing daily squat challenge.
- **Help, backups & settings**: instructions, training terms, WHOOP account controls, export/import, and privacy. Existing workout storage keys and backup format are unchanged.

Use Tab to move between controls, Enter or Space to activate buttons, and arrow keys to move between calendar dates. Escape closes the workout logger or day panel. Dialogs keep keyboard focus inside and return it when closed. System reduced-motion preferences are respected.
