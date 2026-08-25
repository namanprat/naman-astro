import * as THREE from "three/webgpu";
import { mx_noise_float, color, cross, dot, float, transformNormalToView, positionLocal, sign, step, Fn, uniform, varying, vec2, vec3, Loop, vec4,atan,uv,texture,attribute,clamp,pow,length,mix,floor,cos,sin,atan2} from 'three/tsl';

import portrait from '../portrait.png?url';

let pallete = [
    '#8c1dff',
    '#f223ff',
    '#ff2976',
    '#ff901f',
    '#ffd318'
]



export default function getMaterial({
    asciiTexture,
    customLength,
    scene
}){
    let uTexture = new THREE.TextureLoader().load(portrait);

    let material = new THREE.NodeMaterial({
        wireframe: true,
    });

    const uColor1 = uniform(color(pallete[0]));
    const uColor2 = uniform(color(pallete[1]));
    const uColor3 = uniform(color(pallete[2]));
    const uColor4 = uniform(color(pallete[3]));
    const uColor5 = uniform(color(pallete[4]));


    const positionMath = Fn(()=>{
            let theta = atan2(attribute('aPosition').y, attribute('aPosition').x);
            const radius = pow(length(attribute('aPosition')), 0.9);
            const pos = vec3(radius.mul(cos(theta)) , radius.mul(sin(theta)), 0);


            // return positionLocal.add(attribute('aPosition'));
            return positionLocal.add(pos);
    })


    const asciiCode = Fn(()=>{
        const textureColor = texture(uTexture, attribute('aPixelUV'));
        const brightness = clamp(pow(textureColor.r, 1.2).add(attribute('aRandom').mul(0.02)), 0., 0.99);
        const asciiUV = vec2(
            uv().x.div(customLength).add(floor(brightness.mul(customLength)).div(customLength)),
            uv().y
        );
        // const asciiCode = texture(asciiTexture, attribute('aPixelUV'));
        const asciiCode = texture(asciiTexture, asciiUV);
        let finalColor = uColor1;
        finalColor = mix(finalColor, uColor2, step(0.2,brightness ));
        finalColor = mix(finalColor, uColor3, step(0.4,brightness ));
        finalColor = mix(finalColor, uColor4, step(0.6,brightness ));
        finalColor = mix(finalColor, uColor5, step(0.8,brightness ));

        // return vec4(finalColor,1.);
        return asciiCode.mul(finalColor);
        // return vec4(attribute('aPixelUV').x, attribute('aPixelUV').y, 0.0, 1.0)
    })


    material.colorNode = asciiCode();
    material.positionNode = positionMath();
    // material.outputNode = ;

    return material;

}