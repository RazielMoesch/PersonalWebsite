





const projects = [

    {
        slug: "fluid-sim",
        tutorialSlug: "",
        demo_route: "/demos/fluid_sim",
        title: "Fluid Simulation",
        desc: "A canvas that runs a fluid simulation in the browser",
        imgurl: "/fluid_sim_cover.gif",
        stack: ["WebGPU", "React/Next"],
        longDesc: "Based on this project: https://github.com/kishimisu/WebGPU-Fluid-Simulation, this fluid simulation uses code implements a Grid-Based (Eulerian) Fluid Simulation using WebGPU. It follows the classic Stable Fluids method originally proposed by Jos Stam, which solves the incompressible Navier-Stokes equations by breaking the physics down into several discrete compute stages.",
        link: "/demos/fluid_sim"
    },
    {
        slug: "model2model",
        tutorialSlug: "",
        demo_route: "",
        title: "Model To Model",
        desc: "WPGU script that auto transitions between two .glb files",
        imgurl: "/model2model_cover.gif",
        stack: ["WGPU", "RUST", "Compute Shaders"],
        longDesc: "",
        link: ""
    },
    {
        slug: "sphere-orbit",
        tutorialSlug: "",
        demo_route: "/demos/sphere_orbit",
        title: "Sphere & Orbit",
        desc: "A canvas that runs cool looking thing",
        imgurl: "/sphere_orbit_cover.gif",
        stack: ["WebGPU", "React/Next"],
        longDesc: "",
        link: "/demos/sphere_orbit"
    },
    {
        slug: "webheat",
        tutorialSlug: "",
        demo_route: "",
        title: "Webheat: Heat Diffusion Simulation",
        desc: "A canvas that runs a Heat Diffusion Simulation",
        imgurl: "/webheat_cover.gif",
        stack: ["WebGPU", "React", "PDE Approximation"],
        longDesc: "",
        link: ""
    },
    {
        slug: "stl-viewer-rust",
        tutorialSlug: "",
        demo_route: "",
        title: "STL Viewer",
        desc: "A WGPU Rust based STL Viewer",
        imgurl: "/stl_viewer_rust_cover.png",
        stack: ["WGPU", "RUST", "Native"],
        longDesc: "A great beginner project for getting into WGPU the Rust version of WebGPU. Github: https://github.com/RazielMoesch/WGPU-Tutorial-STL-Viewer",
        link: ""
    },

]

export default projects;