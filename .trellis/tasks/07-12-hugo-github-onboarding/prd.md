# New User Hugo and GitHub Onboarding

## Goal

Provide a clear, actionable path for people who do not know Hugo and have not yet created a GitHub repository, so they can prepare a Hugo site and use Draftwell to write and publish posts.

## User Value

Draftwell edits and publishes Hugo content to a repository selected by the user. New users need to understand which setup Draftwell provides, which setup remains their responsibility, and how to reach a publicly hosted blog after publishing.

## Requirements

### R1: Explain the Minimum Prerequisites

- Explain that a user needs a GitHub account to use the current GitHub OAuth and GitHub App flow.
- Explain that the user does not need to install Hugo locally just to write and publish through Draftwell.
- Explain that the user still needs a Hugo site repository or starter template before publishing a complete website.

### R2: Explain the Repository Shape

Provide a minimal repository example containing:

```text
hugo.toml
content/post/
static/images/posts/
```

- Explain that Draftwell currently does not create a GitHub repository automatically.
- Explain that Draftwell currently does not create a complete Hugo site, theme, or `hugo.toml` automatically.
- Recommend starting from a Hugo starter site, GitHub template, or an existing Hugo theme/site.

### R3: Explain the Draftwell Workflow

Document the end-to-end user flow:

1. Create or obtain a GitHub account.
2. Create a Hugo site repository from a starter template.
3. Sign in to Draftwell with GitHub.
4. Install the Draftwell GitHub App and authorize the selected repository.
5. Select the repository, branch, content directory, and media directory in Draftwell.
6. Write, preview, and publish posts and media.

- Preserve the existing default directories `content/post` and `static/images/posts`.
- Explain that Draftwell writes Markdown and media to GitHub and does not store article bodies or media in its database.
- Explain that users do not need to enter a GitHub Personal Access Token.

### R4: Explain Public Website Deployment

- Explain that Draftwell is not the Hugo hosting or rendering pipeline.
- Explain that users must separately connect the repository to a Hugo-capable host.
- Mention GitHub Pages, Cloudflare Pages, Netlify, and Vercel as possible deployment choices.
- Explain that the deployment must run Hugo and publish its generated site output.

### R5: Define the Future Product Direction

Record, without requiring implementation in this task, possible follow-up improvements:

- An onboarding wizard for creating a Hugo site.
- A starter-template or GitHub-template link.
- Empty-repository detection and setup guidance.
- Detection of missing `hugo.toml`, `content/post/`, or `static/images/posts/`.
- Optional GitHub API initialization of a minimal Hugo scaffold.
- Deployment-specific setup guides.

## Out of Scope

- Automatically creating a GitHub repository in this phase.
- Automatically generating a Hugo theme or complete site configuration in this phase.
- Automatically configuring GitHub Pages, Cloudflare Pages, Netlify, or Vercel in this phase.
- Changing the existing GitHub App authorization model or publishing flow.
- Storing article content or media bytes in the Draftwell database.

## Acceptance Criteria

- [ ] New-user documentation distinguishes using Draftwell from deploying a Hugo website.
- [ ] Documentation includes the GitHub account, repository, GitHub App installation, and repository-profile setup flow.
- [ ] Documentation includes the minimal Hugo repository structure.
- [ ] Documentation explicitly states that local Hugo installation is not required for Draftwell authoring.
- [ ] Documentation explicitly states that an empty repository is not a complete Hugo website and needs a starter site or scaffold.
- [ ] Documentation lists at least one public Hugo deployment option and states that Draftwell does not host the site.
- [ ] Existing GitHub login, repository authorization, and publishing behavior remains unchanged.

## Follow-up Implementation Boundary

When this PRD is implemented as a product change, the preferred first increment is documentation and in-app onboarding guidance. Repository creation and Hugo scaffold generation should remain separate, explicitly authorized follow-up features because they introduce additional GitHub write operations and user-facing setup decisions.
