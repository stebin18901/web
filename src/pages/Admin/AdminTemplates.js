// src/admin/AdminTemplates.js
import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

export default function AdminTemplates() {
  const [templates, setTemplates] = useState([]);
  const [formData, setFormData] = useState({ id: "", type: "", template: "", variables: "" });
  const [isEditing, setIsEditing] = useState(false);

  // Fetch templates in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "newsTemplates"), (snapshot) => {
      setTemplates(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Handle form changes
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add or update template
  const handleSubmit = async (e) => {
    e.preventDefault();

    const variablesArray = formData.variables
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v);

    if (isEditing) {
      await updateDoc(doc(db, "newsTemplates", formData.id), {
        type: formData.type,
        template: formData.template,
        variables: variablesArray,
      });
      setIsEditing(false);
    } else {
      await addDoc(collection(db, "newsTemplates"), {
        type: formData.type,
        template: formData.template,
        variables: variablesArray,
      });
    }

    setFormData({ id: "", type: "", template: "", variables: "" });
  };

  // Edit template
  const handleEdit = (t) => {
    setFormData({
      id: t.id,
      type: t.type,
      template: t.template,
      variables: t.variables.join(", "),
    });
    setIsEditing(true);
  };

  // Delete template
  const handleDelete = async (id) => {
    if (window.confirm("Delete this template?")) {
      await deleteDoc(doc(db, "newsTemplates", id));
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">News Templates</h2>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-4 space-y-3 mb-6">
        <input
          type="text"
          name="type"
          value={formData.type}
          onChange={handleChange}
          placeholder="Template Type (e.g., welcome, quiz_complete)"
          className="border p-2 w-full rounded-lg"
          required
        />
        <textarea
          name="template"
          value={formData.template}
          onChange={handleChange}
          placeholder="Template (e.g., Congrats {name}, you scored {score}%)"
          className="border p-2 w-full rounded-lg"
          required
        />
        <input
          type="text"
          name="variables"
          value={formData.variables}
          onChange={handleChange}
          placeholder="Variables (comma separated: name, score, quizName)"
          className="border p-2 w-full rounded-lg"
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition"
        >
          {isEditing ? "Update Template" : "Add Template"}
        </button>
      </form>

      {/* List */}
      <ul className="space-y-3">
        {templates.length === 0 && <p className="text-gray-500">No templates available.</p>}
        {templates.map((t) => (
          <li key={t.id} className="bg-gray-100 rounded-xl p-4 shadow flex justify-between items-start">
            <div>
              <p className="font-semibold">{t.type}</p>
              <p className="text-sm text-gray-700">{t.template}</p>
              <p className="text-xs text-gray-500">
                Variables: {t.variables?.length > 0 ? t.variables.join(", ") : "None"}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(t)}
                className="bg-yellow-500 text-white px-3 py-1 rounded-lg hover:bg-yellow-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
