import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Draggable from 'gsap/Draggable';
import SplitType from 'split-type';


const nameHover = () => {
  const title = document.querySelector('#work-title h2')
      const links = document.querySelectorAll('#brev a')
      const date = document.querySelector('#work-title span')
      const body = document.querySelector('body')
      links.forEach((link) => {
        link.addEventListener('mouseenter', () => {
          title.innerText = link.getAttribute('data-title')
          date.innerText = link.getAttribute('data-year')
          body.classList.add('hovered')
          link.classList.add('hovered')
        })
        link.addEventListener('mouseleave', () => {
          title.innerText = 'Featured Work'
          date.innerText = ''
          body.classList.remove('hovered')
          link.classList.remove('hovered')
        })
      })
    }; 

let target = 0;
      let current = 0;
      let ease = 0.075;

      const slider = document.querySelector("#slider");
      const sliderWrapper = document.querySelector(".slider-wrapper");
      const markerWrapper = document.querySelector(".marker-wrapper");

      let maxScroll = sliderWrapper.offsetWidth - window.innerWidth;

      function lerp(start, end, factor) {
        return start + (end - start) * factor;
      }

      function updateActiveSlideNumber(markerMove, markerMaxMove) {
        const partWidth = markerMaxMove / 10;
        let currentPart = Math.round((markerMove - 70) / partWidth) + 1;
        currentPart = Math.min(10, currentPart);
      }

      function update() {
        current = lerp(current, target, ease);

        gsap.set(".slider-wrapper", {
          x: -current,
        });

        let moveRatio = current / maxScroll;

        let markerMaxMove = window.innerWidth - markerWrapper.offsetWidth - 170;
        let markerMove = 70 + moveRatio * markerMaxMove;
        gsap.set(".marker-wrapper", {
          x: markerMove,
        });

        updateActiveSlideNumber(markerMove, markerMaxMove);

        requestAnimationFrame(update);
      }

      window.addEventListener("resize", () => {
        maxScroll = sliderWrapper.offsetWidth - window.innerWidth;
      });

      window.addEventListener("wheel", (e) => {
        target += e.deltaY;

        target = Math.max(0, target);
        target = Math.min(maxScroll, target);
      });


      gsap.registerPlugin(ScrollTrigger, Draggable);
gsap.config({
  nullTargetWarn: false
});

      
function sliderAnimate() {
  gsap.set('.slider-wrapper a', { x:'-10rem' });  
  const tl = gsap.timeline();
  const splitTypes = document.querySelectorAll("[text-split]")
   splitTypes.forEach((char, i) => {
       const text = new SplitType(char, {
           types: 'chars'
       })

       tl.from(text.chars, {
           y: "100%",
           opacity: 0,
           duration: 2,
           ease: "power3.inOut",
           stagger: {
               amount: 0.15,
           },
       })
   })
  tl.from('.slider-wrapper a', {
    duration: 1.5,
    stagger: 0.07,
    autoAlpha: 0,
    x: 0,
    y: '100%',
    ease: 'power3.inOut',
  },'-=1.25')
}

 const isMobile = window.matchMedia('(max-width: 768px)').matches;

if(!isMobile) update();
if(!isMobile) nameHover();
sliderAnimate();


