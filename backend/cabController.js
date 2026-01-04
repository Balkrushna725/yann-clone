const db = require('../config/db');

// Book a new cab ride
exports.bookCab = async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { user_id, pickup_location, drop_location } = req.body;

    // Input validation
    if (!user_id || !pickup_location || !drop_location) {
      return res.status(400).json({
        success: false,
        message: 'user_id, pickup_location, and drop_location are required'
      });
    }

    await client.query('BEGIN');

    // Find an available driver
    const driverResult = await client.query(
      'SELECT driver_id FROM drivers WHERE is_available = true LIMIT 1 FOR UPDATE'
    );

    if (driverResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'No drivers available at the moment'
      });
    }

    const driver_id = driverResult.rows[0].driver_id;
    const baseFare = 50; // Base fare in currency units
    const distance = calculateDistance(pickup_location, drop_location); // This is a placeholder
    const estimatedFare = baseFare + (distance * 10); // Simple fare calculation

    // Create a new ride request
    const rideResult = await client.query(
      `INSERT INTO cab_rides 
       (user_id, driver_id, pickup_location, drop_location, status, fare, start_time)
       VALUES ($1, $2, $3, $4, 'requested', $5, NULL)
       RETURNING *`,
      [user_id, driver_id, pickup_location, drop_location, estimatedFare]
    );

    // Mark driver as unavailable
    await client.query(
      'UPDATE drivers SET is_available = false WHERE driver_id = $1',
      [driver_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      data: rideResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error booking cab:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book cab',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Driver accepts the ride
exports.acceptRide = async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { ride_id, driver_id } = req.body;

    if (!ride_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id and driver_id are required'
      });
    }

    await client.query('BEGIN');

    // Verify the ride exists and is in requested state
    const rideResult = await client.query(
      `SELECT * FROM cab_rides 
       WHERE ride_id = $1 AND status = 'requested' AND driver_id = $2
       FOR UPDATE`,
      [ride_id, driver_id]
    );

    if (rideResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Ride not found or already accepted'
      });
    }

    // Update ride status to accepted
    await client.query(
      `UPDATE cab_rides 
       SET status = 'accepted', updated_at = NOW() 
       WHERE ride_id = $1`,
      [ride_id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ride accepted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error accepting ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept ride',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Start the ride
exports.startRide = async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { ride_id, driver_id } = req.body;

    if (!ride_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id and driver_id are required'
      });
    }

    await client.query('BEGIN');

    // Verify the ride exists and is in accepted state
    const rideResult = await client.query(
      `SELECT * FROM cab_rides 
       WHERE ride_id = $1 AND status = 'accepted' AND driver_id = $2
       FOR UPDATE`,
      [ride_id, driver_id]
    );

    if (rideResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not in accepted state'
      });
    }

    // Update ride status to ongoing and set start time
    await client.query(
      `UPDATE cab_rides 
       SET status = 'ongoing', start_time = NOW(), updated_at = NOW() 
       WHERE ride_id = $1`,
      [ride_id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ride started successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error starting ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start ride',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// End the ride
exports.endRide = async (req, res) => {
  const client = await db.getClient();
  
  try {
    const { ride_id, driver_id } = req.body;

    if (!ride_id || !driver_id) {
      return res.status(400).json({
        success: false,
        message: 'ride_id and driver_id are required'
      });
    }

    await client.query('BEGIN');

    // Get ride details
    const rideResult = await client.query(
      `SELECT * FROM cab_rides 
       WHERE ride_id = $1 AND status = 'ongoing' AND driver_id = $2
       FOR UPDATE`,
      [ride_id, driver_id]
    );

    if (rideResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Ride not found or not in ongoing state'
      });
    }

    const ride = rideResult.rows[0];
    
    // Calculate final fare (in a real app, this would be more complex)
    const startTime = new Date(ride.start_time);
    const endTime = new Date();
    const durationInMinutes = (endTime - startTime) / (1000 * 60);
    const finalFare = ride.fare + (durationInMinutes * 1.5); // Additional charge for time

    // Update ride status to completed and set end time and final fare
    await client.query(
      `UPDATE cab_rides 
       SET status = 'completed', 
           end_time = NOW(), 
           fare = $1,
           updated_at = NOW() 
       WHERE ride_id = $2`,
      [finalFare, ride_id]
    );

    // Mark driver as available again
    await client.query(
      'UPDATE drivers SET is_available = true WHERE driver_id = $1',
      [driver_id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      data: {
        ride_id,
        final_fare: finalFare,
        duration_minutes: Math.ceil(durationInMinutes)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ending ride:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end ride',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// Report emergency
exports.reportEmergency = async (req, res) => {
  try {
    const { ride_id, user_id, emergency_type, message } = req.body;

    if (!ride_id || !user_id || !emergency_type) {
      return res.status(400).json({
        success: false,
        message: 'ride_id, user_id, and emergency_type are required'
      });
    }

    // In a real application, you would integrate with an emergency service here
    // For now, we'll just log the emergency
    console.log('EMERGENCY ALERT:', {
      ride_id,
      user_id,
      emergency_type,
      message: message || 'No additional details provided',
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Emergency reported successfully. Help is on the way!'
    });
  } catch (error) {
    console.error('Error reporting emergency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to report emergency',
      error: error.message
    });
  }
};

// Helper function to calculate distance between two points (simplified)
function calculateDistance(pickup, drop) {
  // In a real application, you would use a proper geocoding service
  // This is a simplified version that returns a random distance for demonstration
  return Math.floor(Math.random() * 20) + 1; // Random distance between 1-20 km
}
