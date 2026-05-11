import FluidSim from "@/components/fluid_sim";
import "./contact_page.css";



const ContactPage = () => {
    return (
        <>
            <FluidSim />
            <div className="contact-page-container">
                <div className="contact-info-card">
                    <div className="card-header">
                        <span className="status-dot"></span>
                        <p className="availability">Available for projects</p>
                    </div>
                    
                    <h1 className="name-title">Raziel Moesch</h1>
                    <div className="divider"></div>

                    <div className="links-grid">
                        <a href="https://github.com/razielmoesch" target="_blank" className="contact-link">
                            <span className="label">Github</span>
                            <span className="value">github.com/razielmoesch</span>
                        </a>
                        
                        <a href="https://www.linkedin.com/in/raziel-moesch-61474b21b/" target="_blank" className="contact-link">
                            <span className="label">LinkedIn</span>
                            <span className="value">raziel-moesch</span>
                        </a>

                        <a href="mailto:TheRazielMoesch@gmail.com" className="contact-link">
                            <span className="label">Email</span>
                            <span className="value">TheRazielMoesch@gmail.com</span>
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}

export default ContactPage;