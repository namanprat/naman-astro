import { useEffect } from "react";
import type { WorkItem } from "@/content/work";
import { SiteScroll } from "@/lib/site/lenisBoot";
import Footer from "../site/Footer";
import ProjectDetail from "./ProjectDetail";
import "./Work.css";

type Props = {
  item: WorkItem;
};

export default function WorkProject({ item }: Props) {
  useEffect(() => {
    document.documentElement.classList.add("page-work-project");
    return () => {
      document.documentElement.classList.remove("page-work-project");
    };
  }, []);

  return (
    <SiteScroll>
      <article className="work_project">
        <ProjectDetail item={item} variant="page" />
      </article>
      <Footer />
    </SiteScroll>
  );
}
