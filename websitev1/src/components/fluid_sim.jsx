'use client'

import { useEffect, useRef, useState } from "react"
import "./styles/fluid_sim.css"

const shaderSource = `
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

    if (interact.isDown < 0.5) { return; }

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
`

export default function FluidSim() {
    const canvasRef = useRef(null)
    const mouse = useRef({ x: 0, y: 0, vx: 0, vy: 0, down: 0 })
    const [showConsole, setShowConsole] = useState(false)
    const [params, setParams] = useState({
        res: 512, 
        vort: 0.35, 
        dyeDecay: 0.998, 
        velDecay: 0.99, 
        iter: 50,
        radius: 20, 
        strength: 5,
        color: "#ae00ff", 
        symmetry: 0, 
        mode: 0, 
        bloom: 0.05,
        chromatic: 0.5,
        dt: 0.008
    })
    const [brushStyle, setBrushStyle] = useState({ left: 0, top: 0, width: 0, height: 0 })

    const pRef = useRef(params)
    useEffect(() => { pRef.current = params }, [params])

    // Touch/mouse input handlers
    const handleMove = (clientX, clientY, movementX, movementY) => {
        mouse.current.vx = movementX
        mouse.current.vy = movementY
        mouse.current.x = clientX
        mouse.current.y = clientY
    }

    const handleStart = (clientX, clientY) => {
        mouse.current.x = clientX
        mouse.current.y = clientY
        mouse.current.vx = 0
        mouse.current.vy = 0
        mouse.current.down = 1
    }

    const handleEnd = () => {
        mouse.current.down = 0
        mouse.current.vx = 0
        mouse.current.vy = 0
    }

    useEffect(() => {
        let dev, ctx, mod, pipes = {}, uB, iB, dBs, vBs, pB, divB, curB, bgs, frameId
        const init = async () => {
            if (typeof window === 'undefined') return
            const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' })
            if (!adapter) return
            dev = await adapter.requestDevice()
            ctx = canvasRef.current.getContext("webgpu")
            const format = navigator.gpu.getPreferredCanvasFormat()
            ctx.configure({ device: dev, format, alphaMode: 'opaque' })
            mod = dev.createShaderModule({ code: shaderSource })
            const bgl = dev.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                    { binding: 1, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                    { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                    { binding: 3, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
                    { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                    { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                    { binding: 6, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'storage' } },
                    { binding: 7, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'storage' } },
                    { binding: 8, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: 'storage' } },
                ]
            })
            const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] })
            const computePipe = (entry) => dev.createComputePipeline({ layout, compute: { module: mod, entryPoint: entry } })
            pipes = {
                adv: computePipe("advect"), curl: computePipe("calculate_curl"),
                conf: computePipe("confinement"), div: computePipe("divergence"),
                pres: computePipe("pressure"), proj: computePipe("project"),
                render: dev.createRenderPipeline({
                    layout,
                    vertex: { module: mod, entryPoint: "vs" },
                    fragment: { module: mod, entryPoint: "fs", targets: [{ format }] },
                    primitive: { topology: 'triangle-strip' }
                })
            }
            const res = pRef.current.res
            const s = res * res
            uB = dev.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
            iB = dev.createBuffer({ size: 48, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
            vBs = [0,1].map(() => dev.createBuffer({ size: s * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }))
            dBs = [0,1].map(() => dev.createBuffer({ size: s * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }))
            pB = dev.createBuffer({ size: s * 4, usage: GPUBufferUsage.STORAGE })
            divB = dev.createBuffer({ size: s * 4, usage: GPUBufferUsage.STORAGE })
            curB = dev.createBuffer({ size: s * 4, usage: GPUBufferUsage.STORAGE })
            bgs = [0,1].map(i => dev.createBindGroup({
                layout: bgl,
                entries: [
                    { binding: 0, resource: { buffer: uB } },
                    { binding: 1, resource: { buffer: vBs[i] } },
                    { binding: 2, resource: { buffer: vBs[1-i] } },
                    { binding: 3, resource: { buffer: dBs[i] } },
                    { binding: 4, resource: { buffer: dBs[1-i] } },
                    { binding: 5, resource: { buffer: iB } },
                    { binding: 6, resource: { buffer: pB } },
                    { binding: 7, resource: { buffer: divB } },
                    { binding: 8, resource: { buffer: curB } },
                ]
            }))
            const tick = (time) => {
                const curRes = pRef.current.res
                const idx = Math.floor(time / 16) % 2
                const rgb = pRef.current.color.match(/[A-Za-z0-9]{2}/g).map(v => parseInt(v, 16) / 255)
                const ww = typeof window !== 'undefined' ? window.innerWidth : 1920
                const wh = typeof window !== 'undefined' ? window.innerHeight : 1080
                dev.queue.writeBuffer(uB, 0, new Float32Array([pRef.current.dt, curRes, curRes, pRef.current.dyeDecay, pRef.current.velDecay, pRef.current.vort, 0, 0, pRef.current.mode, ...rgb, ww / wh, time/1000, pRef.current.bloom, pRef.current.chromatic]))
                dev.queue.writeBuffer(iB, 0, new Float32Array([
                    (mouse.current.x / ww) * curRes,
                    (mouse.current.y / wh) * curRes,
                    mouse.current.vx,
                    mouse.current.vy,
                    pRef.current.radius,
                    pRef.current.strength,
                    pRef.current.symmetry,
                    mouse.current.down
                ]))
                const enc = dev.createCommandEncoder()
                const runPass = (p, bg) => { 
                    const cp = enc.beginComputePass(); cp.setPipeline(p); cp.setBindGroup(0, bg); 
                    cp.dispatchWorkgroups(Math.ceil(curRes/8), Math.ceil(curRes/8)); cp.end()
                }
                runPass(pipes.adv, bgs[idx]); runPass(pipes.curl, bgs[1-idx]); runPass(pipes.conf, bgs[1-idx])
                runPass(pipes.div, bgs[1-idx]); for(let i=0; i < pRef.current.iter; i++) runPass(pipes.pres, bgs[1-idx])
                runPass(pipes.proj, bgs[1-idx])
                const rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [0,0,0,1], storeOp: 'store' }] })
                rp.setPipeline(pipes.render); rp.setBindGroup(0, bgs[1-idx]); rp.draw(4); rp.end()
                dev.queue.submit([enc.finish()])
                mouse.current.vx *= 0.95; mouse.current.vy *= 0.95
                frameId = requestAnimationFrame(tick)
            }
            tick(0)
        }
        init()
        const resize = () => {
            if (typeof window === 'undefined' || !canvasRef.current) return
            canvasRef.current.width = window.innerWidth
            canvasRef.current.height = window.innerHeight
        }
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', resize)
            resize()
        }
        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            if (dev) dev.destroy()
            if (typeof window !== 'undefined') window.removeEventListener('resize', resize)
        }
    }, [params.res])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const updateBrush = () => {
            setBrushStyle({
                left: mouse.current.x,
                top: mouse.current.y,
                width: params.radius * (window.innerWidth / params.res) * 2,
                height: params.radius * (window.innerWidth / params.res) * 2
            })
        }
        const interval = setInterval(updateBrush, 16)
        return () => clearInterval(interval)
    }, [params.radius, params.res])

    const update = (key, val) => setParams(prev => ({...prev, [key]: val}))

    return (
        <div className="fluid-sim-isolated-root">
            <canvas
                ref={canvasRef}
                className="fluid-canvas"
                onMouseMove={e => handleMove(e.clientX, e.clientY, e.movementX, e.movementY)}
                onMouseDown={() => handleStart(mouse.current.x, mouse.current.y)}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={e => {
                    e.preventDefault()
                    const t = e.touches[0]
                    handleStart(t.clientX, t.clientY)
                }}
                onTouchMove={e => {
                    e.preventDefault()
                    const t = e.touches[0]
                    handleMove(t.clientX, t.clientY, t.clientX - mouse.current.x, t.clientY - mouse.current.y)
                }}
                onTouchEnd={handleEnd}
            />
            <div className="cursor-overlay">
                <div className="brush-indicator" style={brushStyle} />
            </div>
            <button className="console-toggle-btn" onClick={() => setShowConsole(!showConsole)}>
                {showConsole ? "✕" : "⚙️"}
            </button>
            {showConsole && (
                <div className="control-panel">
                    <div className="control-group"><span className="control-label">View</span><select className="control-input" value={params.mode} onChange={e => update('mode', parseInt(e.target.value))}><option value={0}>Art</option><option value={1}>Vel</option><option value={2}>Pres</option></select></div>
                    <div className="control-group"><span className="control-label">Res</span><select className="control-input" value={params.res} onChange={e => update('res', parseInt(e.target.value))}><option value={256}>256</option><option value={512}>512</option><option value={1024}>1024</option></select></div>
                    <div className="control-group"><span className="control-label">Dissolve</span><input type="range" className="range-slider" min="0.9" max="1.0" step="0.001" value={params.dyeDecay} onChange={e => update('dyeDecay', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">VelDecay</span><input type="range" className="range-slider" min="0.9" max="1.0" step="0.001" value={params.velDecay} onChange={e => update('velDecay', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Radius</span><input type="range" className="range-slider" min="5" max="200" value={params.radius} onChange={e => update('radius', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Strength</span><input type="range" className="range-slider" min="1" max="200" value={params.strength} onChange={e => update('strength', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Bloom</span><input type="range" className="range-slider" min="0" max="2" step="0.1" value={params.bloom} onChange={e => update('bloom', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Chroma</span><input type="range" className="range-slider" min="0" max="10" step="0.1" value={params.chromatic} onChange={e => update('chromatic', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Vort</span><input type="range" className="range-slider" min="0" max="1" step="0.01" value={params.vort} onChange={e => update('vort', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Iters</span><input type="range" className="range-slider" min="1" max="100" value={params.iter} onChange={e => update('iter', parseInt(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Time</span><input type="range" className="range-slider" min="0.001" max="0.1" step="0.001" value={params.dt} onChange={e => update('dt', parseFloat(e.target.value))} /></div>
                    <div className="control-group"><span className="control-label">Sym</span><select className="control-input" value={params.symmetry} onChange={e => update('symmetry', parseInt(e.target.value))}><option value={0}>Off</option><option value={1}>Mirror</option><option value={3}>Quad</option></select></div>
                    <input type="color" style={{ width: '100%', height: '30px', border: 'none', background: 'none' }} value={params.color} onChange={e => update('color', e.target.value)} />
                    <button className="action-btn" onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}>Reset</button>
                </div>
            )}
        </div>
    )
}