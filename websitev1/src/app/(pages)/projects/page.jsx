"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import projects from './project_list';
import "./projects_page.css";

const ProjectsPage = () => {
    const router = useRouter();

    return (
        <div className="projects-wrapper">
            <header className="projects-header">
                <h1 className="projects-title">Archive</h1>
                <p className="projects-subtitle">A collection of experiments and tools.</p>
            </header>

            <div className="projects-grid">
                {projects.map((project, index) => (
                    <div key={index} className="project-card-glass">
                        <div 
                            className="project-preview-image" 
                            style={{ backgroundImage: `url(${project.imgurl || '/placeholder.jpg'})` }}
                        >
                            <div className="image-overlay"></div>
                        </div>

                        <div className="project-info">
                            <div className="project-tags">
                                {project.stack.map((tech, i) => (
                                    <span key={i} className="tech-tag">{tech}</span>
                                ))}
                            </div>

                            <h2 className="project-name">{project.title}</h2>
                            <p className="project-short-desc">{project.desc}</p>

                            {/* This wrapper pushes everything below it to the bottom */}
                            <div className="button-footer">
                                {project.demo_route && (
                                    <button 
                                        onClick={() => router.push(project.demo_route)} 
                                        className="btn-demo"
                                    >
                                        Launch Simulation
                                    </button>
                                )}

                                <div className="project-actions">
                                    <Link href={`/projects/${project.slug}`} className="btn-primary">
                                        More Info
                                    </Link>

                                    {project.tutorialSlug && (
                                        <Link href={`/tutorials/${project.tutorialSlug}`} className="btn-secondary">
                                            Tutorial
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectsPage;