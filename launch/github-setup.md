# Putting Home HQ on GitHub: beginner guide

You don't need to know git. Do this in a web browser. Nothing here has been done for you yet.

## 0. Before you publish
- Read `NOTICE.md`. The original photo-frame-dashboard has **no license**, so please **ask Wes Bos
  for permission** first (for example, open an issue on his repo or message @wesbos), and note his answer in `NOTICE.md`.
- Replace the placeholders: `YOUR_NAME` (LICENSE), `dario-d-c`, `Dario_d_c`,
  `YOUR_KOFI_HANDLE` (README.md, .github/FUNDING.yml, launch/x-post.md), and the `[AFFILIATE_LINK_…]` links in README.md.
  Tip: search the folder for `YOUR_` and `AFFILIATE`.

## 1. Create a GitHub account
1. Go to https://github.com/signup.
2. Enter your email, a password and a **username**. The username becomes part of your links
   (`github.com/<username>`), so pick something you're happy to share publicly.
3. Verify your email and turn on two-factor authentication (Settings → Password and authentication).

## 2. Create the repository
1. Click **+** (top right) → **New repository**.
2. Name: `home-hq` (matches the Deploy button link in the README). Description: "Family wall dashboard on Cloudflare Workers".
3. Choose **Public**. **Don't** tick "Add a README" or "Add a license" (we already have them).
4. Click **Create repository**.

## 3. Upload the files
**Easiest (web upload):**
1. On the new empty repo page, click **uploading an existing file**.
2. Drag in the *contents* of the `homehq-public` folder (not the folder itself). Leave out
   `node_modules/`, `dist/`, `.wrangler/` and any `.dev.vars` file (never upload `.dev.vars`, it holds your passcode).
   - Hidden folders like `.github` may not drag in on some systems. If not, create
     `.github/FUNDING.yml` afterwards with **Add file → Create new file** and paste its contents.
3. Commit message: "Initial public release". Click **Commit changes**.

**Or with GitHub Desktop** (https://desktop.github.com): File → Add local repository → choose
`homehq-public` (it's already a git repo) → Publish repository → untick "Keep this code private".

## 4. Check the Deploy button
Open your repo's README and click **Deploy to Cloudflare**. It should start Cloudflare's setup
page. (Deploying a copy to your own account is a good test.)

## 5. Turn on donations
- **Funding button:** `.github/FUNDING.yml` adds a ❤️ **Sponsor** button to the repo once it holds
  real handles. Remove the lines you don't use.
- **GitHub Sponsors:** https://github.com/sponsors → **Join the waitlist / Get started** → fill in the
  profile, connect a bank account (via Stripe) and tax info. Approval can take a few days.
- **Buy Me a Coffee:** sign up at https://buymeacoffee.com and use your page name as `Dario_d_c`.
- **Ko-fi:** sign up at https://ko-fi.com and use your page name as `YOUR_KOFI_HANDLE`.

## 6. Nice extras
- Repo **About** (gear icon): add a website (your demo) and topics: `cloudflare-workers`, `family`, `dashboard`, `kiosk`.
- Settings → General → Features: keep Issues on, and consider turning off Wiki/Projects.
