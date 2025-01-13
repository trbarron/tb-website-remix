import React, { useState, useEffect } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const PizzaLocationMap = () => {
  const [reviewData, setReviewData] = useState([]);
  const [scoreData, setScoreData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [hoveredScore, setHoveredScore] = useState(null);
  const [showReviews, setShowReviews] = useState(true);
  const [showPizzaScore, setShowPizzaScore] = useState(true);
  const [usStates, setUsStates] = useState(null);
  
  // Set up projection for continental US
  const width = 1200;
  const height = 800;
  const projection = geoAlbersUsa()
    .scale(1400)
    .translate([width / 2, height / 2]);

  // Fetch US States data
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
        const topology = await response.json();
        const statesGeo = feature(topology, topology.objects.states);
        setUsStates(statesGeo);
      } catch (error) {
        console.error('Error loading US states:', error);
      }
    };
    fetchStates();
  }, []);

  // Fetch review data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/dominos_locations.json'
        );
        const locations = await response.json();
        setReviewData(locations);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Failed to load location data');
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Fetch pizza score data
  useEffect(() => {
    const loadScoreData = async () => {
      try {
        const response = await fetch(
          'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/pizza_network.json'
        );
        const scores = await response.json();
        setScoreData(scores);
      } catch (error) {
        console.error('Error loading score data:', error);
      }
    };

    loadScoreData();
  }, []);

  // Calculate color based on rating
  const getRatingColor = (rating) => {
    const hue = (rating / 5) * 120;
    return `hsl(${hue}, 70%, 50%)`;
  };

  // Render US states (excluding Alaska and Hawaii)
  const renderStates = () => {
    if (!usStates) return null;
    
    const pathGenerator = geoPath().projection(projection);
    
    return (
      <g className="states">
        {usStates.features
          .filter(feature => {
            // Filter out Alaska (02) and Hawaii (15)
            const id = feature.id;
            return id !== "02" && id !== "15";
          })
          .map((feature, i) => (
            <path
              key={`state-${i}`}
              d={pathGenerator(feature)}
              fill="none"
              stroke="#333"
              strokeWidth="0.5"
            />
          ))}
      </g>
    );
  };

  // Render pizza score heatmap (continental US only)
  const renderPizzaScoreHeatmap = () => {
    if (!showPizzaScore || !scoreData.length) return null;

    return scoreData
      .filter(point => {
        // Rough bounds for continental US
        return point.latitude > 24 && point.latitude < 50 && 
               point.longitude > -125 && point.longitude < -66;
      })
      .map((point, i) => {
      const [x, y] = projection([point.longitude, point.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <circle
          key={`score-${i}`}
          cx={x}
          cy={y}
          r={6}
          fill={getRatingColor(point.pizza_score)}
          opacity={0.3}
          onMouseEnter={() => setHoveredScore(point)}
          onMouseLeave={() => setHoveredScore(null)}
          style={{ cursor: 'pointer' }}
        />
      );
    });
  };

  // Render review points (continental US only)
  const renderReviewPoints = () => {
    if (!showReviews || !reviewData.length) return null;

    return reviewData
      .filter(location => {
        // Rough bounds for continental US
        return location.latitude > 24 && location.latitude < 50 && 
               location.longitude > -125 && location.longitude < -66;
      })
      .map((location, i) => {
      const [x, y] = projection([location.longitude, location.latitude]) || [0, 0];
      if (!x || !y) return null;
      
      return (
        <circle
          key={`review-${i}`}
          cx={x}
          cy={y}
          r={4}
          fill={getRatingColor(location.rating)}
          opacity={0.8}
          onMouseEnter={() => setHoveredLocation(location)}
          onMouseLeave={() => setHoveredLocation(null)}
          style={{ cursor: 'pointer' }}
        />
      );
    });
  };

  // Render hover information
  const renderHoverInfo = () => {
    if (hoveredLocation && showReviews) {
      const [x, y] = projection([hoveredLocation.longitude, hoveredLocation.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <g>
          <rect
            x={x + 10}
            y={y - 50}
            width="220"
            height="90"
            fill="white"
            stroke="#333"
            strokeWidth="1"
            rx="4"
            opacity="0.95"
          />
          <text x={x + 20} y={y - 25} fontSize="14" fontWeight="600" fill="#333">
            {hoveredLocation.name}
          </text>
          <text x={x + 20} y={y} fontSize="13" fill="#666">
            Rating: {hoveredLocation.rating.toFixed(1)} ★
          </text>
          <text x={x + 20} y={y + 25} fontSize="13" fill="#666">
            Reviews: {hoveredLocation.total_ratings.toLocaleString()}
          </text>
        </g>
      );
    }

    if (hoveredScore && showPizzaScore && !showReviews) {
      const [x, y] = projection([hoveredScore.longitude, hoveredScore.latitude]) || [0, 0];
      if (!x || !y) return null;

      return (
        <g>
          <rect
            x={x + 10}
            y={y - 40}
            width="200"
            height="70"
            fill="white"
            stroke="#333"
            strokeWidth="1"
            rx="4"
            opacity="0.95"
          />
          <text x={x + 20} y={y - 15} fontSize="14" fontWeight="600" fill="#333">
            Pizza Score
          </text>
          <text x={x + 20} y={y + 10} fontSize="13" fill="#666">
            Score: {hoveredScore.pizza_score.toFixed(2)} / 5
          </text>
        </g>
      );
    }
  };

  if (loading) {
    return <div className="w-full p-6">Loading location data...</div>;
  }

  if (error) {
    return <div className="w-full p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="w-full h-full bg-white rounded-lg shadow">
      <div className="p-4">       
        <div className="flex items-center gap-8 mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showReviews}
              onChange={(e) => setShowReviews(e.target.checked)}
              className="form-checkbox"
            />
            Show Raw Pizza Reviews
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showPizzaScore}
              onChange={(e) => setShowPizzaScore(e.target.checked)}
              className="form-checkbox"
            />
            Show Calculated Pizza Scores
          </label>
        </div>

        <div className="h-2/4 max-h-[800px] relative bg-gray-100 border rounded-lg">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect width={width} height={height} fill="#f8f9fa" />
            {renderStates()}
            {renderPizzaScoreHeatmap()}
            {renderReviewPoints()}
            {renderHoverInfo()}
          </svg>
        </div>

        <div className="mt-4 grid grid-rows-2 gap-6">
          <div>
            <div className="text-lg font-semibold mb-2">Background</div>
            <div className="text-sm space-y-1">
                <div>This map reveals America's best pizza regions through Domino's Pizza ratings.</div>
                <div>The methodology builds on three key assumptions:</div>
                <div>1. Domino's pizza is Domino's pizza. It is highly standardized nationwide, making it a reliable control variable</div>
                <div>2. Pizza shop employees are constant enough that they impact the ratings in a standardized way</div>
                <div className="pb-2">3. As a result of (1) and (2), the differentiating factor for the reviews is not the pizza, but rather the competitors in the area. The better the local pizza is, the worse Domino's will be rated</div>
                <div>My "Pizza Score" inverts Domino's Google Maps ratings: lower Domino's ratings suggest higher-quality local pizza alternatives. This creates a proxy measure for regional pizza excellence - areas where Domino's struggles are likely areas where local pizzerias thrive</div>
          </div>
          <div>
            <div className="text-lg font-semibold mb-2">Statistics</div>
            <div className="text-sm space-y-1">
              <div>Total Locations: {reviewData.length}</div>
              <div>
                Average Rating:{" "}
                {(reviewData.reduce((sum, loc) => sum + loc.rating, 0) / reviewData.length).toFixed(2)}
              </div>
              <div>
                Total Reviews:{" "}
                {reviewData.reduce((sum, loc) => sum + loc.total_ratings, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PizzaLocationMap;