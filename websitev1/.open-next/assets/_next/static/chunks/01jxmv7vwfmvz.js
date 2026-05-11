(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,1339,e=>{"use strict";var r=e.i(43476),t=e.i(71645);let i=`
struct Uniforms {
    dt: f32, gridW: f32, gridH: f32, dyeDecay: f32,
    velDecay: f32, vorticity: f32, pressure: f32, viscosity: f32,
    renderMode: f32, colorR: f32, colorG: f32, colorB: f32,
    aspect: f32, time: f32, bloom: f32, chromatic: f32,
};

struct Interaction {
    mousePos: vec2<f32>, mouseVel: vec2<f32>,
    radius: f32, strength: f32, symmetry: f32, isDown: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> vIn: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> vOut: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> dIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> dOut: array<f32>;
@group(0) @binding(5) var<uniform> interact: Interaction;
@group(0) @binding(6) var<storage, read_write> pBuf: array<f32>;
@group(0) @binding(7) var<storage, read_write> divBuf: array<f32>;
@group(0) @binding(8) var<storage, read_write> curlBuf: array<f32>;

fn get_idx(p: vec2<i32>) -> u32 {
    let x = clamp(p.x, 0, i32(u.gridW) - 1);
    let y = clamp(p.y, 0, i32(u.gridH) - 1);
    return u32(x) + u32(y) * u32(u.gridW);
}

fn sample_v(p: vec2<f32>) -> vec2<f32> {
    let i = vec2<i32>(floor(p));
    let f = fract(p);
    let v00 = vIn[get_idx(i)];
    let v10 = vIn[get_idx(i + vec2(1,0))];
    let v01 = vIn[get_idx(i + vec2(0,1))];
    let v11 = vIn[get_idx(i + vec2(1,1))];
    return mix(mix(v00, v10, f.x), mix(v01, v11, f.x), f.y);
}

fn sample_d(p: vec2<f32>) -> f32 {
    let i = vec2<i32>(floor(p));
    let f = fract(p);
    let d00 = dIn[get_idx(i)];
    let d10 = dIn[get_idx(i + vec2(1,0))];
    let d01 = dIn[get_idx(i + vec2(0,1))];
    let d11 = dIn[get_idx(i + vec2(1,1))];
    return mix(mix(d00, d10, f.x), mix(d01, d11, f.x), f.y);
}

@compute @workgroup_size(8, 8)
fn advect(@builtin(global_invocation_id) id: vec3<u32>) {
    let pos = vec2<i32>(id.xy);
    if (pos.x >= i32(u.gridW) || pos.y >= i32(u.gridH)) { return; }
    let idx = get_idx(pos);
    let velocity = vIn[idx];
    let back_pos = vec2<f32>(pos) - (velocity * u.dt * 144.0);
    vOut[idx] = sample_v(back_pos) * u.velDecay;
    dOut[idx] = sample_d(back_pos) * u.dyeDecay;

    let syms = array<vec2<f32>, 4>(
        interact.mousePos, 
        vec2(u.gridW - interact.mousePos.x, interact.mousePos.y),
        vec2(interact.mousePos.x, u.gridH - interact.mousePos.y),
        vec2(u.gridW - interact.mousePos.x, u.gridH - interact.mousePos.y)
    );
    var limit = 1;
    if(interact.symmetry > 0.5) { limit = 2; }
    if(interact.symmetry > 2.5) { limit = 4; }

    for(var i=0; i<limit; i++) {
        let d = distance(vec2<f32>(pos), syms[i]);
        let m = exp(-d * d / (interact.radius * interact.radius));
        dOut[idx] += m * interact.strength;
        vOut[idx] += m * interact.mouseVel * 0.5;
    }
}

@compute @workgroup_size(8, 8)
fn calculate_curl(@builtin(global_invocation_id) id: vec3<u32>) {
    let p = vec2<i32>(id.xy);
    let v_l = vIn[get_idx(p + vec2(-1, 0))].y;
    let v_r = vIn[get_idx(p + vec2(1, 0))].y;
    let v_t = vIn[get_idx(p + vec2(0, -1))].x;
    let v_b = vIn[get_idx(p + vec2(0, 1))].x;
    curlBuf[get_idx(p)] = (v_r - v_l) - (v_b - v_t);
}

@compute @workgroup_size(8, 8)
fn confinement(@builtin(global_invocation_id) id: vec3<u32>) {
    let p = vec2<i32>(id.xy);
    let idx = get_idx(p);
    let c_l = abs(curlBuf[get_idx(p + vec2(-1, 0))]);
    let c_r = abs(curlBuf[get_idx(p + vec2(1, 0))]);
    let c_t = abs(curlBuf[get_idx(p + vec2(0, -1))]);
    let c_b = abs(curlBuf[get_idx(p + vec2(0, 1))]);
    let c_c = abs(curlBuf[idx]);
    var force = vec2(c_t - c_b, c_r - c_l);
    force = force / (length(force) + 1e-5) * c_c * u.vorticity;
    vOut[idx] += force;
}

@compute @workgroup_size(8, 8)
fn divergence(@builtin(global_invocation_id) id: vec3<u32>) {
    let p = vec2<i32>(id.xy);
    let v_l = vIn[get_idx(p + vec2(-1, 0))].x;
    let v_r = vIn[get_idx(p + vec2(1, 0))].x;
    let v_t = vIn[get_idx(p + vec2(0, -1))].y;
    let v_b = vIn[get_idx(p + vec2(0, 1))].y;
    divBuf[get_idx(p)] = 0.5 * (v_r - v_l + v_b - v_t);
    pBuf[get_idx(p)] = 0.0;
}

@compute @workgroup_size(8, 8)
fn pressure(@builtin(global_invocation_id) id: vec3<u32>) {
    let p = vec2<i32>(id.xy);
    let idx = get_idx(p);
    let d = divBuf[idx];
    let p_l = pBuf[get_idx(p + vec2(-1, 0))];
    let p_r = pBuf[get_idx(p + vec2(1, 0))];
    let p_t = pBuf[get_idx(p + vec2(0, -1))];
    let p_b = pBuf[get_idx(p + vec2(0, 1))];
    pBuf[idx] = (p_l + p_r + p_t + p_b - d) * 0.25;
}

@compute @workgroup_size(8, 8)
fn project(@builtin(global_invocation_id) id: vec3<u32>) {
    let p = vec2<i32>(id.xy);
    let idx = get_idx(p);
    let p_l = pBuf[get_idx(p + vec2(-1, 0))];
    let p_r = pBuf[get_idx(p + vec2(1, 0))];
    let p_t = pBuf[get_idx(p + vec2(0, -1))];
    let p_b = pBuf[get_idx(p + vec2(0, 1))];
    vOut[idx] -= 0.5 * vec2(p_r - p_l, p_b - p_t);
}

struct VertOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VertOut {
    var p = array<vec2<f32>, 4>(vec2(-1,1), vec2(1,1), vec2(-1,-1), vec2(1,-1));
    var uvs = array<vec2<f32>, 4>(vec2(0,0), vec2(1,0), vec2(0,1), vec2(1,1));
    var out: VertOut;
    out.pos = vec4(p[i], 0, 1);
    out.uv = uvs[i];
    return out;
}

@fragment
fn fs(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let sim_pos = uv * vec2(u.gridW, u.gridH);
    let idx = get_idx(vec2<i32>(sim_pos));
    var finalCol: vec3<f32>;
    let v = sample_v(sim_pos);
    let d = sample_d(sim_pos);

    if (u.renderMode < 0.5) {
        let r = sample_d(sim_pos - v * u.chromatic * 2.0);
        let g = sample_d(sim_pos - v * u.chromatic);
        let b = d;
        let baseCol = vec3(u.colorR, u.colorG, u.colorB);
        finalCol = mix(baseCol * b, vec3(r, g, b), 0.6);
        finalCol += pow(vec3(r, g, b), vec3(4.0)) * u.bloom;
    } else if (u.renderMode < 1.5) {
        finalCol = vec3(abs(v) * 0.1, 0.5);
    } else if (u.renderMode < 2.5) {
        let p = pBuf[idx];
        finalCol = vec3(p * 0.5 + 0.5, p * 0.2, 0.5 - p * 0.5);
    } else {
        let c = curlBuf[idx];
        finalCol = vec3(c * 2.0 + 0.5, 0.5, 0.5 - c * 2.0);
    }
    let vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5));
    return vec4(finalCol * vignette, 1.0);
}
`;e.s(["default",0,function(){let e=(0,t.useRef)(null),a=(0,t.useRef)({x:0,y:0,vx:0,vy:0,down:0}),[n,l]=(0,t.useState)(!1),[s,c]=(0,t.useState)({res:512,vort:.35,dyeDecay:.998,velDecay:.99,iter:50,radius:20,strength:5,color:"#ae00ff",symmetry:0,mode:0,bloom:.05,chromatic:.5,dt:.008}),[o,u]=(0,t.useState)({left:0,top:0,width:0,height:0}),d=(0,t.useRef)(s);(0,t.useEffect)(()=>{d.current=s},[s]),(0,t.useEffect)(()=>{let r,t,n,l={},s,c,o,u,v,p,g,f,m;(async()=>{let x=await navigator.gpu?.requestAdapter({powerPreference:"high-performance"});if(!x)return;r=await x.requestDevice(),t=e.current.getContext("webgpu");let b=navigator.gpu.getPreferredCanvasFormat();t.configure({device:r,format:b,alphaMode:"opaque"}),n=r.createShaderModule({code:i});let _=r.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:6,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}},{binding:7,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}},{binding:8,visibility:GPUShaderStage.COMPUTE|GPUShaderStage.FRAGMENT,buffer:{type:"storage"}}]}),y=r.createPipelineLayout({bindGroupLayouts:[_]}),h=e=>r.createComputePipeline({layout:y,compute:{module:n,entryPoint:e}});l={adv:h("advect"),curl:h("calculate_curl"),conf:h("confinement"),div:h("divergence"),pres:h("pressure"),proj:h("project"),render:r.createRenderPipeline({layout:y,vertex:{module:n,entryPoint:"vs"},fragment:{module:n,entryPoint:"fs",targets:[{format:b}]},primitive:{topology:"triangle-strip"}})};let P=d.current.res,j=P*P;s=r.createBuffer({size:64,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),c=r.createBuffer({size:48,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),u=[0,1].map(()=>r.createBuffer({size:8*j,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})),o=[0,1].map(()=>r.createBuffer({size:4*j,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST})),v=r.createBuffer({size:4*j,usage:GPUBufferUsage.STORAGE}),p=r.createBuffer({size:4*j,usage:GPUBufferUsage.STORAGE}),g=r.createBuffer({size:4*j,usage:GPUBufferUsage.STORAGE}),f=[0,1].map(e=>r.createBindGroup({layout:_,entries:[{binding:0,resource:{buffer:s}},{binding:1,resource:{buffer:u[e]}},{binding:2,resource:{buffer:u[1-e]}},{binding:3,resource:{buffer:o[e]}},{binding:4,resource:{buffer:o[1-e]}},{binding:5,resource:{buffer:c}},{binding:6,resource:{buffer:v}},{binding:7,resource:{buffer:p}},{binding:8,resource:{buffer:g}}]}));let B=e=>{let i=d.current.res,n=Math.floor(e/16)%2,o=d.current.color.match(/[A-Za-z0-9]{2}/g).map(e=>parseInt(e,16)/255),u=window.innerWidth,v=window.innerHeight;r.queue.writeBuffer(s,0,new Float32Array([d.current.dt,i,i,d.current.dyeDecay,d.current.velDecay,d.current.vort,0,0,d.current.mode,...o,u/v,e/1e3,d.current.bloom,d.current.chromatic])),r.queue.writeBuffer(c,0,new Float32Array([a.current.x/u*i,a.current.y/v*i,a.current.vx,a.current.vy,d.current.radius,d.current.strength,d.current.symmetry,1]));let p=r.createCommandEncoder(),g=(e,r)=>{let t=p.beginComputePass();t.setPipeline(e),t.setBindGroup(0,r),t.dispatchWorkgroups(Math.ceil(i/8),Math.ceil(i/8)),t.end()};g(l.adv,f[n]),g(l.curl,f[1-n]),g(l.conf,f[1-n]),g(l.div,f[1-n]);for(let e=0;e<d.current.iter;e++)g(l.pres,f[1-n]);g(l.proj,f[1-n]);let x=p.beginRenderPass({colorAttachments:[{view:t.getCurrentTexture().createView(),loadOp:"clear",clearValue:[0,0,0,1],storeOp:"store"}]});x.setPipeline(l.render),x.setBindGroup(0,f[1-n]),x.draw(4),x.end(),r.queue.submit([p.finish()]),a.current.vx*=.95,a.current.vy*=.95,m=requestAnimationFrame(B)};B(0)})();let x=()=>{e.current&&(e.current.width=window.innerWidth,e.current.height=window.innerHeight)};return window.addEventListener("resize",x),x(),()=>{m&&cancelAnimationFrame(m),r&&r.destroy(),window.removeEventListener("resize",x)}},[s.res]),(0,t.useEffect)(()=>{let e=setInterval(()=>{u({left:a.current.x,top:a.current.y,width:s.radius*(window.innerWidth/s.res)*2,height:s.radius*(window.innerWidth/s.res)*2})},16);return()=>clearInterval(e)},[s.radius,s.res]);let v=(e,r)=>c(t=>({...t,[e]:r}));return(0,r.jsxs)("div",{className:"fluid-sim-isolated-root",children:[(0,r.jsx)("canvas",{ref:e,className:"fluid-canvas",onMouseMove:e=>{a.current.vx=e.movementX,a.current.vy=e.movementY,a.current.x=e.clientX,a.current.y=e.clientY}}),(0,r.jsx)("div",{className:"cursor-overlay",children:(0,r.jsx)("div",{className:"brush-indicator",style:o})}),(0,r.jsx)("button",{className:"console-toggle-btn",onClick:()=>l(!n),children:n?"✕":"⚙️"}),n&&(0,r.jsxs)("div",{className:"control-panel",children:[(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"View"}),(0,r.jsxs)("select",{className:"control-input",value:s.mode,onChange:e=>v("mode",parseInt(e.target.value)),children:[(0,r.jsx)("option",{value:0,children:"Art"}),(0,r.jsx)("option",{value:1,children:"Vel"}),(0,r.jsx)("option",{value:2,children:"Pres"})]})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Res"}),(0,r.jsxs)("select",{className:"control-input",value:s.res,onChange:e=>v("res",parseInt(e.target.value)),children:[(0,r.jsx)("option",{value:256,children:"256"}),(0,r.jsx)("option",{value:512,children:"512"}),(0,r.jsx)("option",{value:1024,children:"1024"})]})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Dissolve"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0.9",max:"1.0",step:"0.001",value:s.dyeDecay,onChange:e=>v("dyeDecay",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"VelDecay"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0.9",max:"1.0",step:"0.001",value:s.velDecay,onChange:e=>v("velDecay",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Radius"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"5",max:"200",value:s.radius,onChange:e=>v("radius",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Strength"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"1",max:"200",value:s.strength,onChange:e=>v("strength",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Bloom"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0",max:"2",step:"0.1",value:s.bloom,onChange:e=>v("bloom",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Chroma"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0",max:"10",step:"0.1",value:s.chromatic,onChange:e=>v("chromatic",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Vort"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0",max:"1",step:"0.01",value:s.vort,onChange:e=>v("vort",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Iters"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"1",max:"100",value:s.iter,onChange:e=>v("iter",parseInt(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Time"}),(0,r.jsx)("input",{type:"range",className:"range-slider",min:"0.001",max:"0.1",step:"0.001",value:s.dt,onChange:e=>v("dt",parseFloat(e.target.value))})]}),(0,r.jsxs)("div",{className:"control-group",children:[(0,r.jsx)("span",{className:"control-label",children:"Sym"}),(0,r.jsxs)("select",{className:"control-input",value:s.symmetry,onChange:e=>v("symmetry",parseInt(e.target.value)),children:[(0,r.jsx)("option",{value:0,children:"Off"}),(0,r.jsx)("option",{value:1,children:"Mirror"}),(0,r.jsx)("option",{value:3,children:"Quad"})]})]}),(0,r.jsx)("input",{type:"color",style:{width:"100%",height:"30px",border:"none",background:"none"},value:s.color,onChange:e=>v("color",e.target.value)}),(0,r.jsx)("button",{className:"action-btn",onClick:()=>{window.location.reload()},children:"Reset"})]})]})}])}]);