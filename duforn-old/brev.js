import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const container = document.querySelectorAll('#gallery-container');

var tl = gsap.timeline({
    scrollTrigger: {
        trigger: '#gallery',
        start: 'top top',
        end: '+=7000 bottom',
        scrub: true,
        pin: true,
    },
});

const galleryEnding = document.querySelectorAll('#gallery-end > h1');


function animateMedia() {

    container.forEach((element) => {
        const medias = element.querySelectorAll('#gallery-bg img');
        const heading = element.querySelectorAll('#gallery-title h1');
        const chips = element.querySelectorAll('#chips-xl li');


        gsap.set(medias, { clipPath: 'inset(0 0 0 0)' });
        gsap.set(heading, { y: "0%" });
        gsap.set(galleryEnding, { y: "-100%", opacity: 0 });


        tl
            .to(
                medias,
                {
                    duration: 3,
                    scale: 1.2,
                },
                
            )
            .to(
                medias,
                {
                    clipPath: 'inset(0 0 100% 0)',
                },
                
            )
            .to(
                heading,
                {
                    yPercent: -100,
                },
                '>-0.7'
            )
            .to(chips,{
                        y: "-100%",
                         opacity: 0,
                         stagger: 0.07,
                     },'>-0.7'
                     );
    });
    // tl.to(galleryEnding, {
    //     y: "100%",
    //     opacity: 0,
    //     stagger: 0.1,
    // });
};

animateMedia();
