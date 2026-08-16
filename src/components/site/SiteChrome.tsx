import Menu from "./Menu";

type Props = {
  /** Current path from Astro — passed through for SSR/hydration parity. */
  pathname?: string;
};

/**
 * Site-wide chrome: main nav + About panel.
 * Mount once from BaseLayout so every page shares the same instance.
 */
export default function SiteChrome({ pathname = "/" }: Props) {
  return <Menu initialPathname={pathname} />;
}
