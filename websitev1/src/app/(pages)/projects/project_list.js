





const projects = [

    {
        slug: "fluid-sim",
        tutorialSlug: "",
        demo_route: "/demos/fluid_sim",
        title: "Fluid Simulation",
        desc: "A canvas that runs a fluid simulation in the browser",
        imgurl: "/fluid_sim_cover.png",
        stack: ["WebGPU", "React/Next"],
        longDesc: "Based on this project: https://github.com/kishimisu/WebGPU-Fluid-Simulation, this fluid simulation uses code implements a Grid-Based (Eulerian) Fluid Simulation using WebGPU. It follows the classic Stable Fluids method originally proposed by Jos Stam, which solves the incompressible Navier-Stokes equations by breaking the physics down into several discrete compute stages.",
        link: "/demos/fluid_sim"
    },

    {
        slug: "webheat",
        tutorialSlug: "",
        demo_route: "",
        title: "Webheat: Heat Diffusion Simulation",
        desc: "A canvas that runs a Heat Diffusion Simulation",
        imgurl: "/webheat_cover.png",
        stack: ["WebGPU", "React", "PDE Approximation"],
        longDesc: "",
        link: ""
    },
    {
        slug: "sphere-orbit",
        tutorialSlug: "",
        demo_route: "/demos/sphere_orbit",
        title: "Sphere & Orbit",
        desc: "A canvas that runs cool looking thing",
        imgurl: "/orbit_cover.png",
        stack: ["WebGPU", "React/Next"],
        longDesc: "",
        link: "/demos/sphere_orbit"
    },

]

export default projects;