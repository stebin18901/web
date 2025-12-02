import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig"; // Import Firestore
import { collection, setDoc, doc, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import "./Schools.css"; // Import the CSS file

const Schools = () => {
  const [schoolName, setSchoolName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState([]);
  const [editSchoolId, setEditSchoolId] = useState(null); // Track the school being edited
  const [searchQuery, setSearchQuery] = useState(""); // For search functionality
  const [password, setPassword] = useState("");

  // Fetch schools from Firestore on component mount
  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const querySnapshot = await getDocs(collection(db, "schools"));
    const schoolsList = [];
    querySnapshot.forEach((doc) => {
      schoolsList.push({ id: doc.id, ...doc.data() });
    });
    setSchools(schoolsList);
  };

  // Handle form submission to add or update a school
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editSchoolId) {
        // Update existing school
        await updateDoc(doc(db, "schools", editSchoolId), {
          schoolName: schoolName,
          schoolId: schoolId,
          password: password,
        });
        alert("School updated successfully!");
        setEditSchoolId(null); // Reset edit mode
      } else {
        // Add new school
        await setDoc(doc(db, "schools", schoolId), {
          schoolName: schoolName,
          schoolId: schoolId,
          password: password,
        });
        alert("School added successfully!");
      }
      setSchoolName("");
      setSchoolId("");
      fetchSchools(); // Refresh the list
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  // Handle deleting a school
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "schools", id));
      alert("School deleted successfully!");
      fetchSchools(); // Refresh the list
    } catch (error) {
      alert("Error deleting school: " + error.message);
    }
  };

  // Handle editing a school
  const handleEdit = (school) => {
    setSchoolName(school.schoolName);
    setSchoolId(school.schoolId);
    setEditSchoolId(school.id); // Set the school ID being edited
    setPassword(school.password || "");
  };

  // Handle search
  const filteredSchools = schools.filter(
    (school) =>
      school.schoolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.schoolId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="schools-container">
      <h1>Manage Schools</h1>
      <form onSubmit={handleSubmit} className="school-form">
        <input
          type="text"
          placeholder="School Name"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="School ID"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          required
        />
        <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        />
        <button type="submit">{editSchoolId ? "Update School" : "Add School"}</button>
      </form>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name or ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* List of Schools */}
      <div className="schools-list">
        <h2>List of Schools</h2>
        {filteredSchools.length > 0 ? (
          <ul>
            {filteredSchools.map((school) => (
              <li key={school.id}>
                <strong>{school.schoolName}</strong> - ID: {school.schoolId}
                <div className="actions">
                  <button onClick={() => handleEdit(school)}>Edit</button>
                  <button onClick={() => handleDelete(school.id)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No schools found.</p>
        )}
      </div>
    </div>
  );
};

export default Schools;