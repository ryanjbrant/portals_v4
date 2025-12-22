import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

// Animated Orb Component with smooth looping animation
const AnimatedOrb = ({ color, size, initialX, initialY, duration }: {
    color: string;
    size: number;
    initialX: number;
    initialY: number;
    duration: number;
}) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Create smooth continuous animations that loop forever
        const animateX = Animated.loop(
            Animated.sequence([
                Animated.timing(translateX, {
                    toValue: 80,
                    duration: duration,
                    useNativeDriver: true,
                }),
                Animated.timing(translateX, {
                    toValue: -80,
                    duration: duration * 1.2,
                    useNativeDriver: true,
                }),
                Animated.timing(translateX, {
                    toValue: 0,
                    duration: duration * 0.8,
                    useNativeDriver: true,
                }),
            ])
        );

        const animateY = Animated.loop(
            Animated.sequence([
                Animated.timing(translateY, {
                    toValue: 60,
                    duration: duration * 0.9,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: -60,
                    duration: duration * 1.1,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: duration,
                    useNativeDriver: true,
                }),
            ])
        );

        const animateScale = Animated.loop(
            Animated.sequence([
                Animated.timing(scale, {
                    toValue: 1.15,
                    duration: duration * 1.5,
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 0.9,
                    duration: duration * 1.3,
                    useNativeDriver: true,
                }),
                Animated.timing(scale, {
                    toValue: 1,
                    duration: duration * 1.2,
                    useNativeDriver: true,
                }),
            ])
        );

        animateX.start();
        animateY.start();
        animateScale.start();

        return () => {
            animateX.stop();
            animateY.stop();
            animateScale.stop();
        };
    }, []);

    return (
        <Animated.View
            style={{
                position: 'absolute',
                left: initialX,
                top: initialY,
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: color,
                opacity: 0.7,
                transform: [{ translateX }, { translateY }, { scale }],
                shadowColor: color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: size * 0.5,
            }}
        />
    );
};

export const AnimatedBackground = () => {
    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {/* Base dark gradient */}
            <LinearGradient
                colors={['#0a0a0f', '#0f0a1a', '#050510', '#000000']}
                locations={[0, 0.3, 0.7, 1]}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Animated morphing orbs - subtle, mesmerizing palette */}
            <View style={styles.orbContainer}>
                <AnimatedOrb color="#6600aa" size={350} initialX={-width * 0.3} initialY={height * 0.1} duration={15000} />
                <AnimatedOrb color="#0055ff" size={300} initialX={width * 0.6} initialY={height * 0.25} duration={18000} />
                <AnimatedOrb color="#8800cc" size={280} initialX={width * 0.2} initialY={height * 0.05} duration={12000} />
                <AnimatedOrb color="#4400aa" size={320} initialX={width * 0.4} initialY={height * 0.35} duration={20000} />
                <AnimatedOrb color="#0044aa" size={250} initialX={width * 0.1} initialY={height * 0.5} duration={16000} />
            </View>

            {/* Triple blur overlay for maximum softness */}
            <BlurView intensity={120} tint="dark" style={StyleSheet.absoluteFillObject}>
                <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject}>
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
                </BlurView>
            </BlurView>

            {/* Subtle vignette overlay */}
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)']}
                locations={[0.5, 1]}
                style={StyleSheet.absoluteFillObject}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    orbContainer: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
});
