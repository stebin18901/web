import React, { useState } from 'react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa';
import emailjs from 'emailjs-com';
import './Footer.css';

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

const Footer = () => {
    // State to hold form data and submission status
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
    });
    const [status, setStatus] = useState('');

    const handleChange = (e) => {
        // This destructuring correctly gets the name and value from the input event
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value, // Uses the input's name to update the correct state key
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('Sending...');

        const serviceID = 'service_sd53c8s';
        const templateID = 'template_ejxsmkx';
        const publicKey = 'dVBA21UagMbySpbua';

        emailjs.sendForm(serviceID, templateID, e.target, publicKey)
            .then((result) => {
                console.log(result.text);
                setStatus('Message sent successfully! 🎉');
                setFormData({ name: '', email: '', message: '' }); // Clear the form
            }, (error) => {
                console.log(error.text);
                setStatus('Failed to send message. Please try again later. 😔');
            });
    };

    return (
        <footer className="footer">
            <div className="footer-content">
                <div className="footer-section about">
                    <img className="footer-logo" src={HEPSY_LOGO} alt="Hepsy logo" />
                    <p>
                        Your ultimate destination for the latest news, events, and
                        community interaction. Join the fun!
                    </p>
                    <div className="contact-info">
                        <span>hespyenterpriseinfo@gmailcom</span>
                    </div>
                    <div className="socials">
                        <a href="https://www.facebook.com" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><FaFacebook /></a>
                        <a href="https://www.twitter.com" aria-label="Twitter" target="_blank" rel="noopener noreferrer"><FaTwitter /></a>
                        <a href="https://www.instagram.com" aria-label="Instagram" target="_blank" rel="noopener noreferrer"><FaInstagram /></a>
                        <a href="https://www.linkedin.com" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><FaLinkedin /></a>
                    </div>
                </div>

                <div className="footer-section contact">
                    <h2>Contact Us</h2>
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            name="name" // Changed from "from_name" to "name"
                            className="text-input contact-input"
                            placeholder="Your name..."
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <input
                            type="email"
                            name="email" // Changed from "from_email" to "email"
                            className="text-input contact-input"
                            placeholder="Your email address..."
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                        <textarea
                            name="message"
                            className="text-input contact-input"
                            placeholder="Your message..."
                            value={formData.message}
                            onChange={handleChange}
                            required
                        ></textarea>
                        <button type="submit" className="btn btn-big contact-btn">
                            Send
                        </button>
                    </form>
                    {status && <p className="form-status">{status}</p>}
                </div>
            </div>

            <div className="footer-bottom">
                &copy; {new Date().getFullYear()} Hepsy | All Rights Reserved
            </div>
        </footer>
    );
};

export default Footer;
