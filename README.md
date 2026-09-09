# duforn

Practice site for [duforn](https://namanprat.com). Astro + React.

```sh
npm install
npm run dev
```

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Starts the dev server                             |
| `npm run build`     | Builds the site to `dist/`                        |
| `npm run preview`   | Serves the built site                             |
| `npm run check`     | Type-checks every `.astro` file                   |
| `npm run format`    | Formats the project with Prettier                 |
| `npm run studio`    | Starts Sanity Studio (`studio-duforn-portfolio/`) |
| `npm run sanity:seed` | Uploads local YAML + `public/` media to Sanity  |

Node 22.12 or newer is required.

Site name, description, canonical origin, and noindex routes live in [`src/consts.ts`](src/consts.ts).

Editorial copy and images load from Sanity project `dj9l9mvw` / dataset `production` at build time. If the dataset is empty or unreachable, the YAML collections in [`src/content/`](src/content/) and files under `public/` are used instead. Copy [`.env.example`](.env.example) to `.env` to override the project, dataset, or add a token.

## License

[MIT](LICENSE). Starter based on Lumos For Astro (copyright Timothy Ricks).
