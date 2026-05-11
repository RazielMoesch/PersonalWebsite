import projects from "../project_list";
import Link from "next/link";
import { notFound } from "next/navigation";
import "./project_detail.css"; // Un-commented this for you

export async function generateStaticParams() {
    return projects.map((project) => ({
        slug: project.slug,
    }));
}

// 1. Change to async function
export default async function ProjectDetailPage({ params }) {
    
    // 2. Await the params
    const { slug } = await params;
    
    // 3. Now find the project
    const project = projects.find((p) => p.slug === slug);

    if (!project) {
        notFound();
    }

    return (
        <main className="detail-wrapper">
            <div className="detail-container">
                <Link href="/projects" className="back-link">
                    ← Back to Archive
                </Link>

                <header className="detail-header">
                    <div className="detail-tags">
                        {project.stack.map((tech, i) => (
                            <span key={i} className="detail-tag">{tech}</span>
                        ))}
                    </div>
                    <h1 className="detail-title">{project.title}</h1>
                    <p className="detail-intro">{project.desc}</p>
                </header>

                <div 
                    className="detail-hero-image" 
                    style={{ backgroundImage: `url(${project.imgurl || '/placeholder.jpg'})` }}
                />

                <section className="detail-content">
                    <div className="content-section">
                        <h2>Overview</h2>
                        <p className="long-desc">{project.longDesc}</p>
                    </div>

                    <div className="detail-actions">
                        {project.link && (
                            <a href={project.link} target="_blank" rel="noopener noreferrer" className="btn-primary">
                                Live Project
                            </a>
                        )}
                        {project.tutorialSlug && (
                            <Link href={`/tutorials/${project.tutorialSlug}`} className="btn-secondary">
                                View Tutorial
                            </Link>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}