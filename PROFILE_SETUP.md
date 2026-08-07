# Profile Enhancement Setup

The existing README content was preserved. The added blocks are surrounded by `NEW ... START` and `NEW ... END` comments so they can be found and edited safely.

## 1. Add the private-contribution token

The daily heatmap workflow needs a GitHub Personal Access Token that can read your profile and the private repositories whose contribution counts you want included.

1. Create a token for your own GitHub account.
2. Grant only the required read access. For a classic token, the source guide recommends `read:user` and `repo` when private repositories are included.
3. Open this profile repository, then go to **Settings → Secrets and variables → Actions**.
4. Create a repository secret named exactly `PROFILE_TOKEN`.
5. Paste the token into that secret. Never write the token in `README.md`, `generate.mjs`, or the workflow file.

## 2. Run the workflow

Open **Actions → Update Profile Heatmap → Run workflow**. After the first successful run, these placeholders will be replaced with your real contribution data:

- `assets/heatmap/dark.svg`
- `assets/heatmap/light.svg`

The workflow also runs every day at `00:17 UTC`.

## 3. Add your portfolio URL

Edit both hero files and search for the empty `portfolio` value:

- `assets/hero/profile-hero-dark.svg`
- `assets/hero/profile-hero-light.svg`

Place your URL inside the empty `<text>` element after the `portfolio` label.

## 4. Complete project placeholders

In `README.md`, search for:

- `Main Contribution:`
- `Project Slot 4`
- `Project Slot 5`
- `Project Slot 6`

Replace the blank values when the information is ready.

## 5. Add writing, writeups, and competition links

The CTF and Writing sections intentionally contain blank placeholders for your future writeups repository, hosted competition, articles, research, and publications.

## Local heatmap generation

```bash
npm ci
export GH_USERNAME="0xAeterNova"
export GH_TOKEN="YOUR_TOKEN"
npm run generate:heatmap
```

PowerShell:

```powershell
npm ci
$env:GH_USERNAME="0xAeterNova"
$env:GH_TOKEN="YOUR_TOKEN"
npm run generate:heatmap
```
