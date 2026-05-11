"use client"; // This is allowed here!

import Link from 'next/link';

export default function ProjectListClient({ projects }) {
    return (
        <div className="projects-grid">
            {projects.map((project, index) => (
                <div key={index} className="project-card-glass">
                    <div 
                        className="project-preview-image" 
                        style={{ backgroundImage: `url(${project.imgurl || '/placeholder.jpg'})` }}
                    />
                    <div className="project-info">
                        <div className="project-tags">
                            {project.stack.map((tech, i) => (
                                <span key={i} className="tech-tag">{tech}</span>
                            ))}
                        </div>
                        <h2 className="project-name">{project.title}</h2>
                        <p className="project-short-desc">{project.desc}</p>
                        <div className="project-actions">
                            <Link href={`/projects/${project.slug}`} className="btn-primary">
                                Case Study
                            </Link>
                            {project.tutorialSlug && (
                                <Link href={`/tutorials/${project.tutorialSlug}`} className="btn-secondary">
                                    Tutorial
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}