import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import AdminQuestions from './AdminQCreate'; // Assuming AdminQuestions is imported correctly
import './AdminSubjects.css';
import AdminQCreate from './AdminQCreate';

const AdminSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // New state for form submission loading

  const subjectsCollectionRef = collection(db, 'subjects');

  // Fetch all subjects
  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const data = await getDocs(subjectsCollectionRef);
      setSubjects(data.docs.map(doc => ({ ...doc.data(), subjectId: doc.id })));
    } catch (error) {
      console.error("Error fetching subjects: ", error);
      alert('Error fetching subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // Add or update subject
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectName.trim()) {
      alert('Subject name cannot be empty.');
      return;
    }

    setIsSubmitting(true); // Start submission loading
    try {
      if (editingId) {
        const subjectDoc = doc(db, 'subjects', editingId);
        await updateDoc(subjectDoc, { subjectName });
        alert('Subject updated successfully!');
        setEditingId(null);
      } else {
        await addDoc(subjectsCollectionRef, { subjectName });
        alert('Subject added successfully!');
      }
      setSubjectName('');
      fetchSubjects(); // Re-fetch subjects to update the list
    } catch (error) {
      console.error("Error saving subject: ", error);
      alert(`Error saving subject: ${error.message}`);
    } finally {
      setIsSubmitting(false); // End submission loading
    }
  };

  // Edit subject
  const handleEdit = (subject) => {
    setSubjectName(subject.subjectName);
    setEditingId(subject.subjectId);
  };

  // Delete subject
  const handleDelete = async (subjectId) => {
    if (window.confirm('Are you sure you want to delete this subject? This action cannot be undone and will not delete associated questions.')) { // More specific warning
      setLoading(true); // Indicate loading for deletion
      try {
        const subjectDoc = doc(db, 'subjects', subjectId);
        await deleteDoc(subjectDoc);
        alert('Subject deleted successfully!');
        fetchSubjects(); // Re-fetch subjects
      } catch (error) {
        console.error("Error deleting subject: ", error);
        alert(`Error deleting subject: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="admin-subjects-container">
      <div className="admin-subjects-card">
        <h2>Manage Subjects</h2>

        <form onSubmit={handleSubmit} className="admin-subject-form">
          <div className="form-input-group">
            <input
              type="text"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="Enter subject name"
              className="subject-input"
              disabled={isSubmitting} // Disable input during submission
              required
            />
            <button type="submit" className="action-button primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Subject' : 'Add Subject')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setSubjectName('');
                }}
                className="action-button secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="subject-list-section">
          <h3>Existing Subjects</h3>
          {loading && !isSubmitting ? ( // Show loading only for initial fetch or deletion, not during form submit
            <p className="loading-message">Loading subjects...</p>
          ) : subjects.length === 0 ? (
            <p className="no-subjects-message">No subjects found. Add a new one above!</p>
          ) : (
            <div className="table-responsive"> {/* For better responsiveness on smaller screens */}
              <table className="subjects-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subject) => (
                    <tr key={subject.subjectId}>
                      <td>{subject.subjectName}</td>
                      <td className="subject-actions">
                        <button onClick={() => handleEdit(subject)} className="action-button edit">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(subject.subjectId)} className="action-button delete">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* AdminQuestions component is rendered here, consider if it should be part of this view or a separate route */}
      <AdminQCreate/>
    </div>
  );
};

export default AdminSubjects;