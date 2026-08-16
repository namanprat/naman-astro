import {
  groupWorkPanels,
  type WorkGroup,
  type WorkItem,
} from "../../content/work";

type Props =
  | { item: WorkItem; variant?: "page"; index?: never }
  | { item: WorkItem; variant: "overlay"; index: number };

function CoverFigure({ item }: { item: WorkItem }) {
  return (
    <figure className="project__cover-media" data-project-preview>
      <img src={item.image} alt={item.alt} draggable={false} />
    </figure>
  );
}

function CoverVideo({ src, title }: { src: string; title: string }) {
  return (
    <figure className="project__cover-video">
      <video
        src={src}
        aria-label={`${title} reveal`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    </figure>
  );
}

function CoverBelowImage({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="project__cover-below">
      <img src={src} alt={alt} draggable={false} />
    </figure>
  );
}

function CopyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="project__copy">
      <h2 className="project__copy-title text-style-h3">{title}</h2>
      <p className="project__copy-body text-style-main">{body}</p>
    </div>
  );
}

function PanelMedia({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="project__panel-media">
      <img src={src} alt={alt} draggable={false} />
    </figure>
  );
}

function CaseBlock({ group }: { group: WorkGroup }) {
  switch (group.kind) {
    case "pair":
      return (
        <section className="project__block project__block--pair">
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
        <section className="project__block project__block--image">
          <div className="container gap-0">
            <div className="grid is-12">
              <PanelMedia src={group.src} alt={group.alt} />
            </div>
          </div>
        </section>
      );
    case "text":
      return (
        <section className="project__block project__block--text">
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
    <div className="project__layout" data-project-track>
      <section className="project__hero">
        <h1 className="project__title text-style-display">{item.title}</h1>
        <div className="container gap-0 project__hero-container">
          <div className="grid is-12 project__hero-grid">
            <div className="project__services">
              <div className="project__services-list">
                {item.services.map((service) => (
                  <h5 key={service} className="text-style-main">
                    {service}
                  </h5>
                ))}
              </div>
            </div>

            <p className="project__body text-style-main">{item.description}</p>
          </div>
        </div>
      </section>

      <section className="project__cover">
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
        className="content__group"
        data-index={props.index}
        data-slug={props.item.slug}
      >
        <ProjectLayout item={props.item} />
      </div>
    );
  }

  return <ProjectLayout item={props.item} />;
}
