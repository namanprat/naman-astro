import {
  groupWorkPanels,
  type WorkGroup,
  type WorkItem,
} from "@/content/work";

type Props =
  | { item: WorkItem; variant?: "page"; index?: never }
  | { item: WorkItem; variant: "overlay"; index: number };

function CoverFigure({ item }: { item: WorkItem }) {
  return (
    <figure className="project_cover_media" data-project-preview>
      <img src={item.image} alt={item.alt} draggable={false} />
    </figure>
  );
}

function CoverVideo({ src, title }: { src: string; title: string }) {
  return (
    <figure className="project_cover_video">
      {/* `data-lazy-src`, not `src`: see `lib/site/lazyVideo.ts`. `/work`
          renders every project's markup for the Flip overlay, so a real `src`
          with `autoPlay` downloaded all of them on arrival. */}
      <video
        data-lazy-src={src}
        aria-label={`${title} reveal`}
        muted
        loop
        playsInline
        preload="none"
      />
    </figure>
  );
}

function CoverBelowImage({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="project_cover_below">
      <img src={src} alt={alt} draggable={false} />
    </figure>
  );
}

function CopyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="project_copy">
      <h2 className="project_copy_title text-style-h3">{title}</h2>
      <p className="project_copy_body text-style-main">{body}</p>
    </div>
  );
}

function PanelMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="project_panel_media">
      {/* Body panels only. The cover above stays eager — it is the Flip
          morph's source and target, so it has to be decoded before the
          transition runs. */}
      <img src={src} alt={alt} draggable={false} loading="lazy" />
    </figure>
  );
}

function CaseBlock({ group }: { group: WorkGroup }) {
  switch (group.kind) {
    case "pair":
      return (
        <section className="project_block is-pair">
          <div className="container gap-0">
            <div className="grid is-12">
              <PanelMedia src={group.src} alt={group.alt} />
              <CopyBlock title={group.title} body={group.body} />
            </div>
          </div>
        </section>
      );
    case "image":
      return (
        <section className="project_block is-image">
          <div className="container gap-0">
            <div className="grid is-12">
              <PanelMedia src={group.src} alt={group.alt} />
            </div>
          </div>
        </section>
      );
    case "text":
      return (
        <section className="project_block is-text">
          <div className="container gap-0">
            <div className="grid is-12">
              <CopyBlock title={group.title} body={group.body} />
            </div>
          </div>
        </section>
      );
    default: {
      const _exhaustive: never = group;
      return _exhaustive;
    }
  }
}

/**
 * Vertical case-study: hero, 4-col cover, then panel copy/images.
 * One markup tree for both the Flip overlay and the hard `/work/[slug]` page.
 */
function ProjectLayout({ item }: { item: WorkItem }) {
  const groups = groupWorkPanels(item.panels);

  return (
    <div className="project_layout" data-project-track>
      <section className="project_hero">
        <h1 className="project_title text-style-display">{item.title}</h1>
        <div className="container gap-0 project_hero_contain">
          <div className="grid is-12 project_hero_grid">
            <div className="project_services">
              <div className="project_services_list">
                {item.services.map((service) => (
                  <h5 key={service} className="text-style-main">
                    {service}
                  </h5>
                ))}
              </div>
            </div>

            <p className="project_body text-style-main">{item.description}</p>
          </div>
        </div>
      </section>

      <section className="project_cover">
        <div className="container gap-0">
          <div className="grid is-12">
            <CoverFigure item={item} />
            {item.coverVideo ? (
              <CoverVideo src={item.coverVideo} title={item.title} />
            ) : null}
            {item.coverImage ? (
              <CoverBelowImage src={item.coverImage} alt={item.alt} />
            ) : null}
          </div>
        </div>
      </section>

      {groups.map((group, index) => (
        <CaseBlock key={`${item.slug}-block-${index}`} group={group} />
      ))}
    </div>
  );
}

export default function ProjectDetail(props: Props) {
  if (props.variant === "overlay") {
    return (
      <div
        className="content_group"
        data-index={props.index}
        data-slug={props.item.slug}
      >
        <ProjectLayout item={props.item} />
      </div>
    );
  }

  return <ProjectLayout item={props.item} />;
}
