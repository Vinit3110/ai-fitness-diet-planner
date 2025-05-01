import React, { useState } from "react";

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
  return basePlans[category]?.[goal] || ["Walk daily & stay active!"];
};

// Fetch Meals (Improved Error Handling - Throws Error on Failure)
const fetchMeals = async (calories, diet) => {
  const apiKey = "f826eb140384494cae78589a15ff49ba"; // !! Still hardcoded as requested for now !!

  const dietMap = {
    veg: "vegetarian",
    "non-veg": "",
    vegan: "vegan",
  };

  const dietParam = dietMap[diet] || "";
  const url = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${calories}&diet=${dietParam}&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);

    // Check if the response status is OK (e.g., 200)
    if (!response.ok) {
        let errorMsg = `API request failed with status ${response.status}`;
        try {
            // Try to parse error details from the API response body
            const errorData = await response.json();
            errorMsg = errorData.message || errorMsg; // Use API's message if available
        } catch (parseError) {
            // Ignore error if response body is not JSON or empty
        }
        console.error("API Error Details:", errorMsg);
        throw new Error(`Failed to fetch meals: ${errorMsg}`); // Throw an error to be caught by handleCalculate
    }


    const data = await response.json();

    // Handle cases where the API might return an empty meals array or no meals key
    if (!data.meals || data.meals.length === 0) {
        console.log("API returned successfully but found no meals for the criteria.");
        return []; // Return empty array if no meals found
    }

    return data.meals.map((meal) => ({
      label: meal.title,
      // Construct URL robustly - check if id exists
      url: meal.id ? `https://spoonacular.com/recipes/${meal.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Basic sanitization
        .replace(/\s+/g, "-")}-${meal.id}` : '#', // Fallback URL
      sourceUrl: meal.sourceUrl // Include sourceUrl if available
    }));

  } catch (error) {
    console.error("Error during fetchMeals execution:", error);
    // Re-throw the error so handleCalculate knows something went wrong
    // Add context if it's not already an Error object with a message
    throw new Error(`Could not retrieve meal data: ${error.message || error}`);
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
  const [loading, setLoading] = useState(false); // Added loading state
  const [error, setError] = useState("");     // Added error state

  const handleChange = (e) => {
    // Clear error when user starts typing again
    if (error) {
      setError("");
    }
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Refactored Handle Calculate using async/await and try/catch/finally
  const handleCalculate = async () => {
    setError("");     // Clear previous errors
    setResult(null);  // Clear previous results
    setLoading(true); // Start loading

    const { name, age, weight, height, gender, activity, goal, diet } = formData;

    // --- Input Validation ---
    if (!name || !age || !weight || !height || !gender || !activity || !goal || !diet) {
      setError("Please fill out all fields.");
      setLoading(false); // Stop loading
      return;
    }

    const weightNum = parseFloat(weight);
    const heightNum = parseFloat(height);
    const ageNum = parseInt(age);

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

      const bmr =
        gender === "male"
          ? 10 * weightNum + 6.25 * heightNum - 5 * ageNum + 5
          : 10 * weightNum + 6.25 * heightNum - 5 * ageNum - 161;

      const activityFactor = activityFactors[activity];
      const goalAdjustment = goalAdjustments[goal];
      const calorieNeed = Math.round(bmr * activityFactor + goalAdjustment);

      const quote = motivationalQuotes[name.length % motivationalQuotes.length];
      const workouts = getWorkoutPlan(category, goal);

      // --- Fetch Meals Asynchronously ---
      // This will now throw an error if fetchMeals fails internally
      const meals = await fetchMeals(calorieNeed, diet);

      // --- Set Result State ONCE --- (Only runs if fetchMeals succeeds)
      setResult({
        bmi,
        bmr: Math.round(bmr),
        category,
        calorieNeed,
        quote,
        workouts,
        meals, // Include fetched meals
      });

    } catch (err) {
      // Handle errors from calculations or fetchMeals
      console.error("Error in handleCalculate:", err);
      // Display the error message thrown by fetchMeals or other calculation errors
      setError(err.message || "An unexpected error occurred while generating the plan.");
      setResult(null); // Ensure result is cleared on error
    } finally {
      // This block runs whether the try block succeeded or failed
      setLoading(false); // Stop loading
    }
  };

  return (
    <div className="container"> {/* Added class for potential styling */}
      <h2>AI-Powered Fitness & Diet Planner</h2>

      {/* Form Inputs - Now Controlled Components */}
      <input type="text" name="name" placeholder="Name" onChange={handleChange} value={formData.name} />
      <input type="number" name="age" placeholder="Age" onChange={handleChange} value={formData.age} min="1"/>
      <input type="number" name="weight" placeholder="Weight (kg)" onChange={handleChange} value={formData.weight} min="0.1" step="0.1"/>
      <input type="number" name="height" placeholder="Height (cm)" onChange={handleChange} value={formData.height} min="1"/>

      <select name="gender" onChange={handleChange} value={formData.gender}>
        <option value="">Select Gender</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
      </select>

      <select name="activity" onChange={handleChange} value={formData.activity}>
        <option value="">Activity Level</option>
        <option value="low">Low (Sedentary)</option>
        <option value="medium">Moderate (Some exercise)</option>
        <option value="high">High (Active lifestyle)</option>
      </select>

      <select name="goal" onChange={handleChange} value={formData.goal}>
        <option value="">Fitness Goal</option>
        <option value="lose">Lose Weight</option>
        <option value="maintain">Maintain Weight</option>
        <option value="gain">Gain Muscle/Weight</option>
      </select>

      <select name="diet" onChange={handleChange} value={formData.diet}>
        <option value="">Diet Preference</option>
        <option value="veg">Vegetarian</option>
        <option value="non-veg">Non-Vegetarian</option>
        <option value="vegan">Vegan</option>
      </select>

      {/* Display Error Messages */}
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}

      {/* Button with Loading State */}
      <button onClick={handleCalculate} disabled={loading} style={{ marginTop: '10px' }}>
        {loading ? "Generating Plan..." : "Generate Plan"}
      </button>

      {/* Display Loading Indicator */}
      {loading && <p>Loading details...</p>}

      {/* Results Section */}
      {result && !loading && ( // Only show results if not loading and result exists
        <div className="result" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <h3>Hello, {formData.name}! Here's your plan:</h3>
          <p><strong>BMI:</strong> {result.bmi} ({result.category})</p>
          <p><strong>BMR:</strong> {result.bmr} kcal/day</p>
          <p><strong>Daily Calorie Need:</strong> {result.calorieNeed} kcal/day</p>

          <h4>Recommended Meals ({result.meals?.length || 0}):</h4>
          {/* Use optional chaining and check length for robustness */}
          {result.meals && result.meals.length > 0 ? (
            <ul>
              {result.meals.map((meal, index) => (
                <li key={index}>
                  <a href={meal.sourceUrl || meal.url} target="_blank" rel="noopener noreferrer">
                    {meal.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>Could not find specific meal suggestions for these criteria.</p>
          )}

          <h4>Workout Plan:</h4>
          {result.workouts && result.workouts.length > 0 ? (
             <ul>
               {result.workouts.map((exercise, index) => (
                 <li key={index}>{exercise}</li>
               ))}
             </ul>
          ) : (
             <p>No specific workout plan generated for this combination.</p>
          )}
            
            <p><strong>Quote:</strong> “{result.quote}”</p>
        </div>
      )}
    </div>
  );
}



export default App;
