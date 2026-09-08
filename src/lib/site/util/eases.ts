import gsap from "gsap";
import CustomEase from "gsap/CustomEase";

gsap.registerPlugin(CustomEase);
CustomEase.create("hop", ".15, 1, .25, 1");
CustomEase.create("introHop", "0.9, 0, 0.1, 1");
