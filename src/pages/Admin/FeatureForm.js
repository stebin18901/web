import React, { useState, useEffect } from 'react';
import RichTextEditor from '../UI/RichTextEditor';

const FeatureForm = ({ feature, onSubmit, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    color: '#4a6bff',
    slug: '',
    image: '',
    imageFile: null,
    blogHtml: ''
  });

  // Initialize form with feature data when editing
  useEffect(() => {
    if (feature) {
      setFormData({
        title: feature.title,
        description: feature.description,
        color: feature.color || '#4a6bff',
        slug: feature.slug,
        image: feature.image || '',
        imageFile: null,
        blogHtml: feature.blogHtml || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        color: '#4a6bff',
        slug: '',
        image: '',
        imageFile: null,
        blogHtml: ''
      });
    }
  }, [feature]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          image: reader.result,
          imageFile: file
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleHtmlChange = (html) => {
    setFormData(prev => ({ ...prev, blogHtml: html }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Generate slug if empty
    const finalSlug = formData.slug || 
      formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    
    onSubmit({
      ...formData,
      slug: finalSlug
    });
  };

  return (
    <form onSubmit={handleSubmit} className="feature-form">
      <div className="form-group">
        <label>Title*</label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          required
        />
      </div>

      <div className="form-group">
        <label>Description*</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Color</label>
          <input
            type="color"
            name="color"
            value={formData.color}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Slug</label>
          <input
            type="text"
            name="slug"
            value={formData.slug}
            onChange={handleChange}
            placeholder="Auto-generated if empty"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Feature Image</label>
        {formData.image && (
          <div className="image-preview">
            <img src={formData.image} alt="Preview" />
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
      </div>

      <div className="form-group">
        <label>Content*</label>
        <RichTextEditor
          value={formData.blogHtml}
          onChange={handleHtmlChange}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={isLoading}
          className="submit-btn"
        >
          {isLoading ? 'Processing...' : feature ? 'Update' : 'Add'} Feature
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="cancel-btn"
          >
            Cancel
          </button>
        )}
      </div>

      <style jsx>{`
        .feature-form {
          display: grid;
          gap: 1.5rem;
        }
        .form-group {
          display: grid;
          gap: 0.5rem;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 1rem;
        }
        .image-preview {
          margin-bottom: 1rem;
        }
        .image-preview img {
          max-width: 100%;
          max-height: 200px;
          border-radius: 4px;
        }
        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }
        .submit-btn {
          background: #4a6bff;
          color: white;
        }
        .cancel-btn {
          background: #f0f0f0;
        }
      `}</style>
    </form>
  );
};

export default FeatureForm;