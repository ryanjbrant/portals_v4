import { db, auth } from '../config/firebase';
import { doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import LocationService from './LocationService';
import { EventEmitter } from '../utils/EventEmitter';

// Configuration
const FUEL_PER_KM = 50; // 50 Fuel per km walked
const DISTANCE_BATCH_THRESHOLD = 0.1; // Update DB every 100m (0.1km) to save writes
const DAILY_CAP = 2000; // Max daily fuel from walking

class FuelService extends EventEmitter {
    private static instance: FuelService;
    private accumulatedDistance = 0;
    private pendingFuel = 0;
    private totalDailyFuel = 0;
    private lastSaveTime = Date.now();
    private userId: string | null = null;

    private constructor() {
        super();
        this.initialize();
    }

    public static getInstance(): FuelService {
        if (!FuelService.instance) {
            FuelService.instance = new FuelService();
        }
        return FuelService.instance;
    }

    private initialize() {
        // Listen to location movement
        LocationService.on('distance_moved', (kmDelta: number) => {
            if (!this.userId) return;
            this.handleDistanceMoved(kmDelta);
        });

        // Set User ID when auth changes (call Sync manually for now from Auth stack)
        // Ideally we listen to Auth state here too, but let's expose specific init method
    }

    public setUserId(uid: string) {
        this.userId = uid;
        this.loadFuelStats();
    }

    private async loadFuelStats() {
        if (!this.userId) return;

        try {
            const userRef = doc(db, 'users', this.userId);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.fuelStats) {
                    // Check daily reset
                    const lastReset = new Date(data.fuelStats.lastDailyReset || 0);
                    const now = new Date();

                    if (lastReset.getDate() !== now.getDate() || lastReset.getMonth() !== now.getMonth()) {
                        // New Day
                        this.totalDailyFuel = 0;
                        this.updateDailyReset();
                    } else {
                        this.totalDailyFuel = data.fuelStats.dailyEarned || 0;
                    }
                }
            }
        } catch (e) {
            console.warn('[FuelService] Failed to load stats', e);
        }
    }

    private async updateDailyReset() {
        if (!this.userId) return;
        const userRef = doc(db, 'users', this.userId);
        await updateDoc(userRef, {
            'fuelStats.dailyEarned': 0,
            'fuelStats.lastDailyReset': new Date().toISOString()
        });
    }

    private handleDistanceMoved(km: number) {
        if (this.totalDailyFuel >= DAILY_CAP) return;

        this.accumulatedDistance += km;
        const earned = km * FUEL_PER_KM;

        // Cap check
        const allowed = Math.min(earned, DAILY_CAP - this.totalDailyFuel);
        if (allowed <= 0) return;

        this.pendingFuel += allowed;
        this.totalDailyFuel += allowed;

        // Emit local update immediately for UI smoothness
        this.emit('fuel_earned', { amount: allowed, reason: 'walking' });

        // Batch write to Firestore
        if (this.accumulatedDistance >= DISTANCE_BATCH_THRESHOLD) {
            this.flushPendingFuel();
        }
    }

    private async flushPendingFuel() {
        if (!this.userId || this.pendingFuel <= 0) return;

        const amount = Math.floor(this.pendingFuel); // Integer only
        const distance = this.accumulatedDistance;

        // Reset buffers
        this.pendingFuel -= amount;
        this.accumulatedDistance = 0;

        if (amount === 0) return;

        try {
            const userRef = doc(db, 'users', this.userId);
            await updateDoc(userRef, {
                'fuelStats.totalEarned': increment(amount),
                'fuelStats.totalWalkedKm': increment(distance),
                'fuelStats.dailyEarned': increment(amount),
                // Also legacy logical "fuel" field if it exists? 
                // types/index.ts usually puts it in `fuelStats` or we might have a top level balance?
                // Let's assume we store balance in `fuelStats.totalEarned` purely or separate wallet?
                // For now, let's assume `fuelStats.totalEarned` is lifetime XP. 
                // If there is a spendable balance, distinct from XP, we should increment that too.
                // Let's assume we have a top-level `fuelBalance` for spending.
                fuelBalance: increment(amount)
            });
            console.log(`[FuelService] Flushed ${amount} Fuel, ${distance.toFixed(2)}km`);
        } catch (e) {
            console.error('[FuelService] Failed to flush fuel', e);
            // Restore buffer on fail? 
            // For MVP, just log.
        }
    }

    /**
     * Award Fuel for specific actions (Discovery, etc)
     */
    public async awardFuel(amount: number, reason: string) {
        if (!this.userId) return;

        try {
            const userRef = doc(db, 'users', this.userId);
            await updateDoc(userRef, {
                'fuelStats.totalEarned': increment(amount),
                'fuelBalance': increment(amount) // Spendable
            });
            this.emit('fuel_earned', { amount, reason });
            console.log(`[FuelService] Awarded ${amount} for ${reason}`);
        } catch (e) {
            console.error('[FuelService] Failed to award fuel', e);
        }
    }

    /**
     * Spend Fuel (e.g. unlocking content)
     */
    public async spendFuel(amount: number): Promise<boolean> {
        if (!this.userId) return false;

        // Transaction ideally, but optimistic check for MVP
        try {
            const userRef = doc(db, 'users', this.userId);
            const snap = await getDoc(userRef);
            const balance = snap.data()?.fuelBalance || 0;

            if (balance < amount) return false;

            await updateDoc(userRef, {
                fuelBalance: increment(-amount)
            });

            this.emit('fuel_spent', amount);
            return true;
        } catch (e) {
            console.error('[FuelService] Failed to spend fuel', e);
            return false;
        }
    }
}

export default FuelService.getInstance();
