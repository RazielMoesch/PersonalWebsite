'use client'

import { useRouter } from "next/navigation";
import { useState } from "react";
import "./styles/navbar.css";

const Navbar = () => {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="navbar-container">
            <div className="navbar-left-container">
                <h1 className="navbar-title" onClick={() => router.push("/")}>
                    <span className="navbar-full-name">Raziel Moesch</span>
                    <span className="navbar-short-name">RM</span>
                </h1>
            </div>

            {/* Hamburger button toggles based on isOpen state */}
            <div className={`hamburger-${isOpen ? "open" : "closed"}`} onClick={() => setIsOpen(p => !p)}>
                <img src="/burger.png" alt="menu-white" className="navbar-burger"/>
            </div>

            {/* Menu container switches to -burger suffix when open on mobile */}
            <div className={`navbar-right-container${isOpen ? "-burger" : ""}`}>
                <p className="navbar-link-text" onClick={() => { router.push("/projects"); setIsOpen(false); }}>Projects</p>
                <p className="navbar-link-text" onClick={() => { router.push("/contact"); setIsOpen(false); }}>Contact</p>
            </div>
        </div>
    );
}

export default Navbar;