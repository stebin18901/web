import React, { useState, useRef, useEffect } from "react";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

const AdminAddFeature = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4a6bff");
  const [slug, setSlug] = useState("");
  const [image, setImage] = useState(null);
  const [blogHtml, setBlogHtml] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [features, setFeatures] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const editorRef = useRef(null);

  const storage = getStorage();
  const db = getFirestore();

  // Fetch all features
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "features"));
        const featuresData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFeatures(featuresData);
      } catch (error) {
        console.error("Error fetching features:", error);
        setMessage("Failed to load features");
      }
    };
    fetchFeatures();
  }, [db, message]);

  const handleImageUpload = async () => {
    if (!image) return null;
    const imageRef = ref(storage, `features/${uuidv4()}_${image.name}`);
    await uploadBytes(imageRef, image);
    return await getDownloadURL(imageRef);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description || !slug || !blogHtml) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setUploading(true);
      let imageUrl = selectedFeature?.image || "";
      
      // Only upload new image if one was selected
      if (image) {
        // Delete old image if it exists and we're editing
        if (editingId && selectedFeature?.image) {
          try {
            const oldImageRef = ref(storage, selectedFeature.image);
            await deleteObject(oldImageRef);
          } catch (error) {
            console.warn("Error deleting old image:", error);
          }
        }
        
        imageUrl = await handleImageUpload();
      }

      const featureData = {
        title,
        description,
        slug,
        color,
        image: imageUrl,
        blogHtml,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        // Update existing feature
        await updateDoc(doc(db, "features", editingId), featureData);
        setMessage("Feature updated successfully!");
      } else {
        // Add new feature
        featureData.createdAt = new Date().toISOString();
        await addDoc(collection(db, "features"), featureData);
        setMessage("Feature added successfully!");
      }

      // Refresh features list
      const querySnapshot = await getDocs(collection(db, "features"));
      const featuresData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFeatures(featuresData);
      
      // Reset form
      resetForm();
    } catch (error) {
      console.error("Error saving feature:", error);
      setMessage(`Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSlug("");
    setColor("#4a6bff");
    setImage(null);
    setBlogHtml("");
    setEditingId(null);
    setSelectedFeature(null);
  };

  const handleEdit = (feature) => {
    setTitle(feature.title);
    setDescription(feature.description);
    setSlug(feature.slug);
    setColor(feature.color || "#4a6bff");
    setBlogHtml(feature.blogHtml);
    setEditingId(feature.id);
    setSelectedFeature(feature);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this feature? This cannot be undone.")) {
      try {
        // Get the feature first to access the image URL
        const featureToDelete = features.find(f => f.id === id);
        
        // Delete the image from storage if it exists
        if (featureToDelete?.image) {
          try {
            const imageRef = ref(storage, featureToDelete.image);
            await deleteObject(imageRef);
          } catch (error) {
            console.warn("Error deleting image:", error);
          }
        }
        
        // Delete the document from Firestore
        await deleteDoc(doc(db, "features", id));
        setMessage("Feature deleted successfully!");
        setFeatures(features.filter(f => f.id !== id));
        
        // If we were editing this feature, reset the form
        if (editingId === id) {
          resetForm();
        }
      } catch (error) {
        console.error("Error deleting feature:", error);
        setMessage(`Error: ${error.message}`);
      }
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (selectedFeature) {
      setSelectedFeature({
        ...selectedFeature,
        image: ""
      });
    }
  };

  const viewFeatureDetails = (feature) => {
    setSelectedFeature(feature);
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedFeature(null);
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
        {/* Add/Edit Form */}
        <div>
          <h2>{editingId ? "Edit Feature" : "Add New Feature"}</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                required
              />
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", minHeight: "80px" }}
                required
              />
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Slug *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
                required
              />
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ width: "50px", height: "50px", cursor: "pointer" }}
              />
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Feature Image {editingId && "(Leave empty to keep current image)"}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files[0])}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
              />
              
              {(selectedFeature?.image || image) && (
                <div style={{ marginTop: "1rem", position: "relative" }}>
                  <img 
                    src={image ? URL.createObjectURL(image) : selectedFeature.image} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: "100%", 
                      maxHeight: "200px",
                      borderRadius: "4px",
                      border: "1px solid #eee"
                    }} 
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      backgroundColor: "rgba(255, 0, 0, 0.7)",
                      color: "white",
                      border: "none",
                      borderRadius: "50%",
                      width: "24px",
                      height: "24px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>Content *</label>
              {/* Replace with your rich text editor component */}
              <textarea
                value={blogHtml}
                onChange={(e) => setBlogHtml(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ddd", minHeight: "200px" }}
                required
              />
            </div>
            
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button 
                type="submit" 
                disabled={uploading}
                style={{ 
                  padding: "10px 20px",
                  backgroundColor: "#4a6bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  flex: 1
                }}
              >
                {uploading ? "Processing..." : editingId ? "Update Feature" : "Add Feature"}
              </button>
              
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {message && (
            <p style={{ 
              marginTop: "1rem", 
              color: message.includes("Error") ? "red" : "green",
              padding: "10px",
              backgroundColor: message.includes("Error") ? "#ffebee" : "#e8f5e9",
              borderRadius: "4px"
            }}>
              {message}
            </p>
          )}
        </div>

        {/* Features List */}
        <div>
          <h2>Manage Features ({features.length})</h2>
          <div style={{ 
            maxHeight: "80vh", 
            overflowY: "auto",
            border: "1px solid #eee",
            borderRadius: "8px",
            padding: "1rem"
          }}>
            {features.length === 0 ? (
              <p>No features added yet</p>
            ) : (
              <div style={{ display: "grid", gap: "1rem" }}>
                {features.map(feature => (
                  <div 
                    key={feature.id} 
                    style={{
                      border: "1px solid #eee",
                      borderRadius: "8px",
                      padding: "1rem",
                      backgroundColor: editingId === feature.id ? "#f0f7ff" : "white"
                    }}
                  >
                    <div 
                      style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem", cursor: "pointer" }}
                      onClick={() => viewFeatureDetails(feature)}
                    >
                      {feature.image && (
                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          style={{ 
                            width: "80px", 
                            height: "80px",
                            objectFit: "cover",
                            borderRadius: "4px"
                          }} 
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: "0 0 0.5rem 0",
                          color: feature.color || "#4a6bff"
                        }}>
                          {feature.title}
                        </h3>
                        <p style={{ margin: "0", color: "#666" }}>{feature.description}</p>
                        <p style={{ 
                          margin: "0.5rem 0 0 0",
                          fontSize: "0.8rem",
                          color: "#999"
                        }}>
                          {new Date(feature.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div style={{ 
                      display: "flex", 
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                      justifyContent: "flex-end"
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(feature);
                        }}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#4a6bff",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem"
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(feature.id);
                        }}
                        style={{
                          padding: "5px 10px",
                          backgroundColor: "#ff6b6b",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "0.8rem"
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {showDetailModal && selectedFeature && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "2rem",
            maxWidth: "800px",
            maxHeight: "90vh",
            overflowY: "auto",
            width: "90%",
            position: "relative"
          }}>
            <button
              onClick={closeModal}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                backgroundColor: "transparent",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#666"
              }}
            >
              ×
            </button>
            
            <h2 style={{ 
              marginTop: "0",
              color: selectedFeature.color || "#4a6bff"
            }}>
              {selectedFeature.title}
            </h2>
            
            {selectedFeature.image && (
              <div style={{ margin: "1rem 0" }}>
                <img 
                  src={selectedFeature.image} 
                  alt={selectedFeature.title}
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "300px",
                    borderRadius: "8px",
                    border: "1px solid #eee"
                  }} 
                />
              </div>
            )}
            
            <p style={{ color: "#666", margin: "1rem 0" }}>{selectedFeature.description}</p>
            
            <div style={{ margin: "1rem 0" }}>
              <h4 style={{ marginBottom: "0.5rem" }}>Content:</h4>
              <div 
                dangerouslySetInnerHTML={{ __html: selectedFeature.blogHtml }} 
                style={{ 
                  border: "1px solid #eee",
                  borderRadius: "4px",
                  padding: "1rem"
                }}
              />
            </div>
            
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between",
              marginTop: "1.5rem",
              color: "#999",
              fontSize: "0.9rem"
            }}>
              <span>Created: {new Date(selectedFeature.createdAt).toLocaleString()}</span>
              <span>Last Updated: {new Date(selectedFeature.updatedAt).toLocaleString()}</span>
            </div>
            
            <div style={{ 
              display: "flex", 
              gap: "1rem",
              marginTop: "1.5rem",
              justifyContent: "flex-end"
            }}>
              <button
                onClick={() => {
                  handleEdit(selectedFeature);
                  closeModal();
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4a6bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Edit Feature
              </button>
              <button
                onClick={() => {
                  closeModal();
                  handleDelete(selectedFeature.id);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ff6b6b",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Delete Feature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAddFeature;