import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ActivityIndicator,
    Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

// Mock Icons for RN
const MailIcon = () => <Text style={{ fontSize: 18 }}>✉️</Text>;
const LockIcon = () => <Text style={{ fontSize: 18 }}>🔒</Text>;
const EyeIcon = () => <Text style={{ fontSize: 18 }}>👁️</Text>;

const LoginScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = () => {
        setIsLoading(true);
        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            // navigation.navigate('Dashboard');
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Background Ambient Blobs (Faked with Views) */}
            <View style={[styles.blob, styles.blob1]} />
            <View style={[styles.blob, styles.blob2]} />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.header}>
                    <Text style={styles.logo}>TaskOrbit</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Enter your credentials to access</Text>

                    <View style={styles.inputContainer}>
                        <View style={styles.iconContainer}>
                            <MailIcon />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Email or User ID"
                            placeholderTextColor="#9ab"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <View style={styles.iconContainer}>
                            <LockIcon />
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="#9ab"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity
                            style={styles.eyeIcon}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <EyeIcon />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.rememberMe}>
                            <View style={styles.checkbox}></View>
                            <Text style={styles.rememberText}>Remember me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity>
                            <Text style={styles.forgotPassword}>Forgot password?</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleLogin}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#6a4918" />
                        ) : (
                            <Text style={styles.loginButtonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default LoginScreen;

/* 
  React Native Claymorphism Shadows Approach:
  Since inset box shadows native to CSS aren't fully supported, we rely on 
  prominent drop shadows, rounding, and specific background colors to mimic 
  the puffy, soft 3D look.
*/
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e8eef2', // var(--bg-main)
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    blob: {
        position: 'absolute',
        borderRadius: 200,
        opacity: 0.6,
    },
    blob1: {
        width: 300,
        height: 300,
        backgroundColor: '#ffb4a2',
        top: -50,
        left: -50,
    },
    blob2: {
        width: 400,
        height: 400,
        backgroundColor: '#a2d2ff',
        bottom: -100,
        right: -100,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logo: {
        fontSize: 32,
        fontWeight: '800',
        color: '#2d3748',
        textShadowColor: 'rgba(255, 255, 255, 0.8)',
        textShadowOffset: { width: 2, height: 2 },
        textShadowRadius: 4,
    },
    card: {
        backgroundColor: '#f3f7f9',
        borderRadius: 40,
        padding: 30,
        // Outer drop shadows for clay effect
        shadowColor: '#aebfce',
        shadowOffset: { width: 10, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.6)',
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: '#2d3748',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#718096',
        marginBottom: 30,
        textAlign: 'center',
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8eef2',
        borderRadius: 20,
        marginBottom: 20,
        paddingHorizontal: 15,
        height: 60,
        // Inset-like effect with shadow opposite
        shadowColor: '#ffffff',
        shadowOffset: { width: -4, height: -4 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
        // Secondary dark shadow
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#d0d8df',
    },
    iconContainer: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#2d3748',
        fontWeight: '500',
    },
    eyeIcon: {
        padding: 10,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    rememberMe: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        backgroundColor: '#e8eef2',
        borderRadius: 6,
        marginRight: 8,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderColor: '#d0d8df',
    },
    rememberText: {
        color: '#718096',
        fontWeight: '500',
    },
    forgotPassword: {
        color: '#e8b167',
        fontWeight: '700',
    },
    loginButton: {
        backgroundColor: '#fcca88',
        borderRadius: 20,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#aebfce',
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    loginButtonText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6a4918',
        letterSpacing: 0.5,
    },
});
