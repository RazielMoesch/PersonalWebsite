'use client'

import { mat4 } from "gl-matrix";
import { useEffect, useRef, useState } from "react";
import "./sphere_orbit.css";


const shader = 
`
struct Uniforms {
    mvp: mat4x4<f32>,
    color1: vec4<f32>,
    color2: vec4<f32>,
    time: f32,
    radius: f32,
    orbitPercent: f32,
    orbitSpeed: f32,
    orbitRadius: f32,
    drift: f32
};

struct VIn {
    @location(0) pos: vec3<f32>,
    @location(1) data: f32
};

struct VOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) v_pos: vec3<f32>
};


@group(0) @binding(0) var<uniform> ui: Uniforms;


@vertex
fn vs( in: VIn ) -> VOut {
    var out: VOut;
    var p = in.pos;
    if ( in.data < ui.orbitPercent ) {
        let individualSpeed = ui.orbitSpeed * ( 1.0 + fract(in.data * 100.0) * 0.5 );
        let angle = ui.time * individualSpeed + ( in.data * 6.28 );
        let s = sin(angle);
        let c = cos(angle);
        let driftX = sin(ui.time * 0.5 + in.data * 10.0) * ui.drift;
        let driftY = cos(ui.time * 0.3 + in.data * 15.0 ) * ui.drift;
        p = vec3<f32>(
            (p.x * c - p.z * s) * ui.orbitRadius + driftX,
            p.y * ui.orbitRadius + driftY,
            (p.x * s + p.z * c) * ui.orbitRadius
        );
    } else {
        p = p * ui.radius;    
    }

    out.pos = ui.mvp * vec4<f32>(p, 1.0);
    out.v_pos = in.pos;
    return out;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4<f32> {

    let mixFactor = in.v_pos.y * 0.5 + 0.5;
    let color = mix(ui.color1, ui.color2, mixFactor);
    return vec4<f32>(color.rgb, 1.0);

}
`;


const getRandomColor = () => {
   return `#` + Math.floor(Math.random() * 16777215 ).toString(16).padStart(6, '0');
}


let SphereOrbitDemo = () => {

    const canvasRef = useRef(null);
    const [mounted, setMounted] = useState(false);
    const [particleCount, setParticleCount] = useState(3e4);
    const [pendingParticleCount, setPendingParticleCount] = useState(3e4);
    const [orbitPercent, setOrbitPercent] = useState(0.5);
    const [orbitSpeed, setOrbitSpeed] = useState(1.0);
    const [orbitRadius, setOrbitRadius] = useState(2.0);
    const [drift, setDrift] = useState(0.5);
    const [radius, setRadius] = useState(0.5);
    const [color1, setColor1] = useState("#ff0044");
    const [color2, setColor2] = useState("#0066ff");
    const [isOpen, setIsOpen] = useState(false);
    const [autoRotate, setAutoRotate] = useState(true);
    const [autoZoom, setAutoZoom] = useState(true);

    const settings = useRef(
        {
            radius: 0.5,
            orbitPercent: 0.5,
            orbitSpeed: 1.0,
            orbitRadius: 2.0,
            drift: 0.5,
            colors: { color1: [1, 0, 0, 1], color2: [0, 0, 1, 1] },
            rotation: { x: 0, y: 0 },
            targetRotation: { x: 0, y: 0 },
            zoom: -6.0,
            autoRotate: true,
            autoZoom: true,
            isDragging: false,
            lastPointer: { x: 0, y: 0, },
        }
    );

    const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    };

    const randomize = () => {
        setOrbitPercent(0.2 + Math.random() * 0.6);
        setOrbitSpeed(0.4 + Math.random() * 1.4);
        setOrbitRadius(1.5 + Math.random() * 2.0);
        setDrift(0.1 + Math.random() * 0.7);
        setRadius(0.4 + Math.random() * 0.6);
        setColor1(getRandomColor());
        setColor2(getRandomColor());
    }

    useEffect(
        () => {
            randomize();
            setMounted(true);
            
        }, []
    );

    useEffect(
        () => {
            if (!mounted) return;
            settings.current.radius = radius;
            settings.current.orbitPercent = orbitPercent;
            settings.current.orbitSpeed = orbitSpeed;
            settings.current.orbitRadius = orbitRadius;
            settings.current.drift = drift;
            settings.current.colors.color1 = hexToRgb(color1);
            settings.current.colors.color2 = hexToRgb(color2);
            settings.current.autoRotate = autoRotate;
            settings.current.autoZoom = autoZoom;
        }, [ radius, orbitPercent, color1, color2, autoRotate, autoZoom, orbitSpeed, orbitRadius, drift, mounted ]
    );

    useEffect(
        () => {
            if (!mounted || !navigator.gpu) return;
            let device, uBuffer, vBuffer, context, animationFrameId;
            
            let init = async () => {

                const adapter = await navigator.gpu.requestAdapter();
                if (!adapter) return;

                device = await adapter.requestDevice();
                context = canvasRef.current.getContext("webgpu");
                const format = navigator.gpu.getPreferredCanvasFormat();
                context.configure({device, format});
                const shaderModule = device.createShaderModule({code: shader});

                const data = new Float32Array(particleCount * 4);
                for ( let  i = 0; i < particleCount; i++ ) {
                    const phi = Math.acos(-1 + ( 2*i ) / particleCount);
                    const theta  = Math.sqrt(particleCount * Math.PI) * phi;
                    data[i*4] = Math.cos(theta) * Math.sin(phi);
                    data[i*4+1] = Math.sin(theta) * Math.sin(phi);
                    data[i*4+2] = Math.cos(phi);
                    data[i*4+3] = i / particleCount;
                }

                vBuffer = device.createBuffer({
                    size: data.byteLength,
                    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: true
                });
                new Float32Array(vBuffer.getMappedRange()).set(data);
                vBuffer.unmap();

                uBuffer = device.createBuffer({
                    size: 160,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
                });

                const pipeline = device.createRenderPipeline(
                    {
                        layout: "auto",
                        vertex: {
                            module: shaderModule,
                            entryPoint: "vs",
                            buffers: [{
                                arrayStride: 16,
                                attributes: [
                                    { shaderLocation: 0, offset: 0, format: "float32x3" },
                                    { shaderLocation: 1, offset: 12, format: "float32" }
                                ]
                            }],
                        },
                        fragment: {
                            module: shaderModule,
                            entryPoint: "fs",
                            targets: [
                                {
                                    format,
                                    blend: {
                                        color:  { operation: "add", srcFactor: "one", dstFactor: "one" },
                                        alpha:  { operation: "add", srcFactor: "one", dstFactor: "one" },
                                    }
                                }
                            ],
                            
                        },
                        primitive: { topology: "point-list" }
                    }
                );

                const bindGroup = device.createBindGroup({
                    layout: pipeline.getBindGroupLayout(0),
                    entries: [{ binding: 0, resource: { buffer: uBuffer } }]
                });

                const handlePointerDown = (e) => {
                    if (e.target.closest('.control-panel') || e.target.closest('.console-toggle-button')) return;

                    settings.current.isDragging = true;
                    settings.current.lastPointer = { x: e.clientX, y: e.clientY }
                };

                const handlePointerMove = (e) => {
                    if (settings.current.isDragging) {
                    const isMobile = window.innerWidth < 768;
                    const sens = isMobile ? 0.02 : 0.007;
                    const deltaX = e.clientX - settings.current.lastPointer.x;
                    const deltaY = e.clientY - settings.current.lastPointer.y;
                    
                    settings.current.targetRotation.y += deltaX * sens;
                    settings.current.targetRotation.x += deltaY * sens;
                    
                    settings.current.lastPointer = { x: e.clientX, y: e.clientY };
                    }
                };

                const handlePointerUp = () => {
                    settings.current.isDragging = false;
                };

                const handleWheel = (e) => {
                    if (e.target.closest('.control-panel')) return;
                    e.preventDefault();
                    settings.current.zoom = Math.min(Math.max(settings.current.zoom + e.deltaY * -0.002, -40), -0.5);
                };

                window.addEventListener('pointerdown', handlePointerDown);
                window.addEventListener('pointermove', handlePointerMove);
                window.addEventListener('pointerup', handlePointerUp);
                window.addEventListener('wheel', handleWheel, { passive: false });
                
                const viewProj = mat4.create();
                const view = mat4.create();
                const proj = mat4.create();

                const render = (time) => {
                    if (!canvasRef.current) return;
                    const aspect = canvasRef.current.width / canvasRef.current.height;
                    mat4.perspective(proj, Math.PI / 4, aspect, 0.1, 100);
                    mat4.identity(view);

                    let currentZoom = settings.current.zoom;
                    if ( settings.current.autoZoom ) {
                        currentZoom += Math.sin(time * 0.0005) * 2.0;
                    }

                    mat4.translate(view, view, [0, 0, currentZoom]);

                    if ( settings.current.autoRotate && !settings.current.isDragging ) {
                        settings.current.targetRotation.y += 0.003;
                    }

                    settings.current.rotation.x += (settings.current.targetRotation.x - settings.current.rotation.x) * 0.1;
                    settings.current.rotation.y += (settings.current.targetRotation.y - settings.current.rotation.y) * 0.1;

                    mat4.rotateX(view, view, settings.current.rotation.x);
                    mat4.rotateY(view, view, settings.current.rotation.y);
                    mat4.multiply(viewProj, proj, view);

                    const uData = new Float32Array(40);
                    uData.set(viewProj, 0);
                    uData.set(settings.current.colors.color1, 16);
                    uData.set(settings.current.colors.color2, 20);
                    uData[24] = time / 1000;
                    uData[25] = settings.current.radius;
                    uData[26] = settings.current.orbitPercent; 
                    uData[27] = settings.current.orbitSpeed;
                    uData[28] = settings.current.orbitRadius;
                    uData[29] = settings.current.drift;

                    device.queue.writeBuffer(uBuffer, 0, uData);

                    const encoder = device.createCommandEncoder();
                    const pass = encoder.beginRenderPass({
                        colorAttachments: [{
                            view: context.getCurrentTexture().createView(),
                            clearValue: { r: 0, g: 0, b: 0, a: 1 },
                            loadOp: "clear", storeOp: "store",
                        }]
                    });

                    pass.setPipeline(pipeline);
                    pass.setBindGroup(0, bindGroup);
                    pass.setVertexBuffer(0, vBuffer);
                    pass.draw(particleCount);
                    pass.end();

                    device.queue.submit([encoder.finish()]);
                    animationFrameId = requestAnimationFrame(render);
                }

                animationFrameId = requestAnimationFrame(render);

                return () => {
                    cancelAnimationFrame(animationFrameId);
                    window.removeEventListener('pointerdown', handlePointerDown);
                    window.removeEventListener('pointermove', handlePointerMove);
                    window.removeEventListener('pointerup', handlePointerUp);
                    window.removeEventListener('wheel', handleWheel);
                };

            }

            const cleanupPromise = init();

            const resize = () => {
                if (canvasRef.current) {
                    canvasRef.current.width = window.innerWidth;
                    canvasRef.current.height = window.innerHeight;
                }
            };

            window.addEventListener('resize', resize);
            resize();

            return () => {
                window.removeEventListener('resize', resize);
                cleanupPromise.then(cleanup => cleanup && cleanup());
            }

        }, [mounted, particleCount]
    );

    useEffect(
        () => {
            const timer = setTimeout(() => {
                setParticleCount(pendingParticleCount);
            }, 400);
            return () => clearTimeout(timer);
        }, [pendingParticleCount]
    );

    if (!mounted) return <div></div>


    return (
    <>
    <div className="sphere-orbit-container">

        <canvas ref={canvasRef} className="sphere-orbit-canvas"></canvas>


        <button className="console-toggle-button" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? '✕' : '⚙️'}
        </button>

        {
            isOpen && 
            <>
                <div className="control-panel">

                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Particle Count: {pendingParticleCount}</span>
                        <input type="range" min={1e3} max={1.5e5} step={1e3} value={pendingParticleCount} onChange={(e) => setPendingParticleCount(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>

                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Orbit Bias: {(orbitPercent * 100).toFixed(0)}%</span>
                        <input type="range" min={0.0} max={1.0} step={0.01} value={orbitPercent} onChange={(e) => setOrbitPercent(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>

                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Core Size</span>
                        <input type="range" min={0.1} max={1.5} step={0.05} value={radius} onChange={(e) => setRadius(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>

                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Orbit Size</span>
                        <input type="range" min={0.5} max={6.0} step={0.1} value={orbitRadius} onChange={(e) => setOrbitRadius(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>
                    
                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Speed</span>
                        <input type="range" min={0.1} max={3.0} step={0.1} value={orbitSpeed} onChange={(e) => setOrbitSpeed(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>

                    <div className="control-panel-section">
                        <span className="control-panel-option-title">Drift</span>
                        <input type="range" min={0.0} max={1.0} step={0.05} value={drift} onChange={(e) => setDrift(parseFloat(e.target.value))} className="control-panel-slider"/>
                    </div>

                    <div className="console-color-row">
                        <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} className="console-color-input" />
                        <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} className="console-color-input" />
                    </div>

                    <label className="checkbox-label">
                        <input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} /> Auto-Spin
                    </label>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={autoZoom} onChange={(e) => setAutoZoom(e.target.checked)} /> Breathing Zoom
                    </label>
                    <button onClick={() => randomize()} className="reload-button">
                        RE-ROLL SEED
                    </button>

                </div>
            </>
        }

    </div>
    </>
    )

}


export default SphereOrbitDemo;