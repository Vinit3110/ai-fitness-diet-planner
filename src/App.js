import React, { useState } from "react";
import "./App.css"; // Make sure App.css is updated with new classes

// --- Constants --- (No changes needed here)
const activityFactors = {
  low: 1.2,
  medium: 1.55,
  high: 1.9,
};

const goalAdjustments = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

const motivationalQuotes = [
  "The journey of a thousand miles begins with a single step.",
  "Push yourself, because no one else is going to do it for you.",
  "Success starts with self-discipline.",
  "Believe you can and you're halfway there.",
];

// --- Helper Functions ---

// Get Workout Plan (No changes needed here)
const getWorkoutPlan = (category, goal) => {
  const basePlans = {
    Underweight: { gain: ["Bodyweight Squats - 3x12", "Push-ups - 3x10", "Plank - 3x30 sec"], maintain: ["Light Jogging - 2x10 min", "Stretching - 2x15 min"] },
    Normal: { lose: ["Cardio HIIT - 3x20 min", "Bodyweight Circuit - 3x15 reps"], gain: ["Squats - 4x10", "Deadlifts - 4x8", "Push-ups - 3x12"], maintain: ["Jogging - 3x20 min", "Plank - 3x45 sec"] },
    Overweight: { lose: ["Walking - 30 mins", "Modified Squats - 3x10", "Wall Push-ups - 3x10"], maintain: ["Swimming - 20 mins", "Cycling - 30 mins"] },
    Obese: { lose: ["Seated Marching - 3x20", "Chair Squats - 3x10", "Ankle Rotations - 3x15"], maintain: ["Walking - 20 mins", "Stretching - 15 mins"] },
  };
  // Use optional chaining for safety and provide a default fallback
  return basePlans[category]?.[goal] || ["Walk daily & stay active!"];
};

// Fetch Meals (Improved Error Handling & Using Environment Variable for API Key)
const fetchMeals = async (calories, diet) => {
  // *** NECESSARY CHANGE: Use Environment Variable for API Key ***
  const apiKey = process.env.REACT_APP_SPOONACULAR_API_KEY;

  // Check if the API key is loaded correctly
  if (!apiKey) {
      console.error("Spoonacular API key is missing. Make sure it's set in the .env file as REACT_APP_SPOONACULAR_API_KEY and the server was restarted.");
      throw new Error("API configuration error. Cannot fetch meals."); // Informative error for developer/user
  }

  const dietMap = {
    veg: "vegetarian",
    "non-veg": "", // Spoonacular default is often non-veg if no diet specified
    vegan: "vegan",
  };

  const dietParam = dietMap[diet] || "";
  const url = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${calories}&diet=${dietParam}&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      let errorMsg = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        // Use more specific error message from Spoonacular if available
        errorMsg = errorData.message || errorMsg;
      } catch (parseError) {
         // Ignore error if response body is not JSON or empty
         console.warn("Could not parse error response from API:", parseError);
      }
      console.error("API Error Details:", errorMsg);
      // Provide a more user-friendly error message if it's a common API key issue
      if (response.status === 401 || response.status === 402) { // Unauthorized or Payment Required
          errorMsg = "There was an issue accessing the meal service (API key invalid or quota exceeded?). Please contact support.";
      }
      throw new Error(`Failed to fetch meals: ${errorMsg}`);
    }

    const data = await response.json();

    if (!data.meals || data.meals.length === 0) {
      console.log("API returned successfully but found no meals for the criteria.");
      return []; // Return empty array is fine, UI will handle it
    }

    // Ensure meal.id exists before using it for the URL
    return data.meals.map((meal) => ({
      id: meal.id, // Include ID for use as key
      label: meal.title,
      url: meal.sourceUrl, // Prefer sourceUrl if available as it's direct
      // Fallback URL construction if sourceUrl is missing
      fallbackUrl: meal.id ? `https://spoonacular.com/recipes/${meal.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Basic sanitization
        .replace(/\s+/g, "-")}-${meal.id}` : '#',
    }));

  } catch (error) {
    // Log the original error for debugging, but re-throw a potentially more user-friendly one
    console.error("Error during fetchMeals execution:", error);
    // Check if it's the specific error we threw earlier
    if (error.message.startsWith("Failed to fetch meals:") || error.message.startsWith("API configuration error.")) {
        throw error; // Re-throw our custom error
    }
    // Throw a generic error for other network or unexpected issues
    throw new Error(`Could not retrieve meal data. Please check your connection or try again later.`);
  }
};


// --- Main Component ---
function App() {
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    gender: "",
    activity: "",
    goal: "",
    diet: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    if (error) {
      setError(""); // Clear error on interaction
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCalculate = async () => {
    setError("");
    setResult(null);
    setLoading(true);

    const { name, age, weight, height, gender, activity, goal, diet } = formData;

    // --- Input Validation ---
    if (!name || !age || !weight || !height || !gender || !activity || !goal || !diet) {
      setError("Please fill out all fields.");
      setLoading(false);
      return;
    }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseInt(age, 10); // Added radix 10 for parseInt

    if (isNaN(weightNum) || isNaN(heightNum) || isNaN(ageNum)) {
       setError("Please enter valid numbers for age, weight, and height.");
       setLoading(false);
       return;
    }
    if (weightNum <= 0 || heightNum <= 0 || ageNum <= 0) {
       setError("Age, weight, and height must be positive numbers.");
       setLoading(false);
       return;
    }
    // --- End Validation ---

    try {
      // --- Calculations ---
      const bmi = (weightNum / (heightNum / 100) ** 2).toFixed(2);
      let category = "";
      if (bmi < 18.5) category = "Underweight";
      else if (bmi < 25) category = "Normal";
      else if (bmi < 30) category = "Overweight";
      else category = "Obese";

      // Mifflin-St Jeor Equation for BMR
      const bmr =
        gender === "male"
          ? 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5
          : 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;

      const activityFactor = activityFactors[activity];
      const goalAdjustment = goalAdjustments[goal];
      // Ensure calorie need is not negative (e.g., extreme lose goal with low BMR)
      const calorieNeed = Math.max(1200, Math.round(bmr * activityFactor + goalAdjustment)); // Set a minimum floor like 1200

      const quote = motivationalQuotes[name.length % motivationalQuotes.length];
      const workouts = getWorkoutPlan(category, goal);

      // --- Fetch Meals Asynchronously ---
      const meals = await fetchMeals(calorieNeed, diet); // Will throw if it fails

      // --- Set Result State ONCE ---
      setResult({
        bmi,
        bmr: Math.round(bmr),
        category,
        calorieNeed,
        quote,
        workouts,
        meals,
      });

    } catch (err) {
      console.error("Error in handleCalculate:", err);
      // Display the error message thrown by fetchMeals or other calculation errors
      setError(err.message || "An unexpected error occurred while generating the plan.");
      setResult(null); // Ensure result is cleared on error
    } finally {
      setLoading(false); // Stop loading regardless of success or failure
    }
  };

  return (
    <div className="container">
      <h2>AI-Powered Fitness & Diet Planner</h2>

      {/* Form Inputs - Using Labels for Accessibility */}
      <div className="form-group">
        <label htmlFor="nameInput">Name:</label>
        <input id="nameInput" type="text" name="name" placeholder="Enter your name" onChange={handleChange} value={formData.name} required />
      </div>

      <div className="form-group">
        <label htmlFor="ageInput">Age:</label>
        <input id="ageInput" type="number" name="age" placeholder="e.g., 30" onChange={handleChange} value={formData.age} min="1" required />
      </div>

      <div className="form-group">
        <label htmlFor="weightInput">Weight (kg):</label>
        <input id="weightInput" type="number" name="weight" placeholder="e.g., 70" onChange={handleChange} value={formData.weight} min="0.1" step="0.1" required />
      </div>

      <div className="form-group">
         <label htmlFor="heightInput">Height (cm):</label>
        <input id="heightInput" type="number" name="height" placeholder="e.g., 175" onChange={handleChange} value={formData.height} min="1" required/>
      </div>

      <div className="form-group">
        <label htmlFor="genderSelect">Gender:</label>
        <select id="genderSelect" name="gender" onChange={handleChange} value={formData.gender} required>
          <option value="">Select Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="activitySelect">Activity Level:</label>
        <select id="activitySelect" name="activity" onChange={handleChange} value={formData.activity} required>
          <option value="">Select Activity Level</option>
          <option value="low">Low (Sedentary)</option>
          <option value="medium">Moderate (Some exercise)</option>
          <option value="high">High (Active lifestyle)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="goalSelect">Fitness Goal:</label>
        <select id="goalSelect" name="goal" onChange={handleChange} value={formData.goal} required>
          <option value="">Select Fitness Goal</option>
          <option value="lose">Lose Weight</option>
          <option value="maintain">Maintain Weight</option>
          <option value="gain">Gain Muscle/Weight</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="dietSelect">Diet Preference:</label>
        <select id="dietSelect" name="diet" onChange={handleChange} value={formData.diet} required>
          <option value="">Select Diet Preference</option>
          <option value="veg">Vegetarian</option>
          <option value="non-veg">Non-Vegetarian</option>
          <option value="vegan">Vegan</option>
        </select>
      </div>

      {/* Display Error Messages */}
      {error && <p className="error-message">{error}</p>}

      {/* Button with Loading State */}
      <button className="submit-button" onClick={handleCalculate} disabled={loading}>
        {loading ? "Generating Plan..." : "Generate Plan"}
      </button>

      {/* Display Loading Indicator */}
      {loading && <p className="loading-message">Loading details...</p>}

      {/* Results Section */}
      {result && !loading && (
        <div className="results-section">
          <h3>Hello, {formData.name}! Here's your plan:</h3>
          <p><strong>BMI:</strong> {result.bmi} ({result.category})</p>
          <p><strong>BMR (Basal Metabolic Rate):</strong> {result.bmr} kcal/day</p>
          <p><strong>Estimated Daily Calorie Need:</strong> {result.calorieNeed} kcal/day</p>

          <h4>Recommended Meals ({result.meals?.length || 0}):</h4>
          {result.meals && result.meals.length > 0 ? (
            <ul>
              {result.meals.map((meal) => (
                // *** Use meal.id as key if available and unique ***
                <li key={meal.id}>
                  <a href={meal.url || meal.fallbackUrl} target="_blank" rel="noopener noreferrer">
                    {meal.label}
                  </a>
                  {/* Optionally display sourceUrl if different and desired */}
                  {/* {meal.url && meal.fallbackUrl && meal.url !== meal.fallbackUrl && <span> (<a href={meal.fallbackUrl} target="_blank" rel="noopener noreferrer">details</a>)</span>} */}
                </li>
              ))}
            </ul>
          ) : (
            <p>Could not find specific meal suggestions for these criteria.</p>
          )}

          <h4>Workout Plan:</h4>
          {result.workouts && result.workouts.length > 0 ? (
             <ul>
               {/* For workouts without unique IDs, index is acceptable */}
               {result.workouts.map((exercise, index) => (
                 <li key={index}>{exercise}</li>
               ))}
             </ul>
          ) : (
             <p>No specific workout plan generated for this combination.</p>
          )}

          <p><strong>Quote for the day:</strong> “{result.quote}”</p>
        </div>
      )}
    </div>
  );
}

export default App;
