import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useRef, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#0D0D0D",
  line: "#242424",
  lineFocus: "#C4A882",
  text: "#EDE9E3",
  textSub: "#5A5A5A",
  textMuted: "#2E2E2E",
  accent: "#C4A882",
  accentDim: "rgba(196,168,130,0.08)",
  err: "#CF6679",
  errBg: "rgba(207,102,121,0.08)",
  errBorder: "rgba(207,102,121,0.22)",
};

// ─── Input ────────────────────────────────────────────────────────────────────

type InputProps = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "default";
  autoComplete?: "email" | "password" | "off";
  autoCapitalize?: "none" | "sentences";
};

function Input({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoComplete,
  autoCapitalize,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const anim = useRef(new Animated.Value(value.length > 0 ? 1 : 0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;

  const floated = focused || value.length > 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: floated ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [floated]);

  useEffect(() => {
    Animated.timing(lineAnim, {
      toValue: focused ? 1 : 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [focused]);

  const labelTop = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const labelSize = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 10],
  });
  const labelColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.textSub, C.accent],
  });
  const lineColor = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [C.line, C.lineFocus],
  });

  return (
    <View style={s.inputWrap}>
      <Animated.Text
        style={[
          s.inputLabel,
          { top: labelTop, fontSize: labelSize, color: labelColor },
        ]}
      >
        {label}
      </Animated.Text>
      <TextInput
        style={s.inputField}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPw}
        keyboardType={keyboardType ?? "default"}
        autoComplete={autoComplete ?? "off"}
        autoCapitalize={autoCapitalize ?? "none"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={C.accent}
        keyboardAppearance="dark"
      />
      {secureTextEntry && (
        <TouchableOpacity
          onPress={() => setShowPw((v) => !v)}
          style={s.eyeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showPw ? "eye-outline" : "eye-off-outline"}
            size={16}
            color={C.textSub}
          />
        </TouchableOpacity>
      )}
      <Animated.View style={[s.inputLine, { backgroundColor: lineColor }]} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const brandOp = useRef(new Animated.Value(0)).current;
  const brandY = useRef(new Animated.Value(18)).current;
  const formOp = useRef(new Animated.Value(0)).current;
  const formY = useRef(new Animated.Value(24)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.parallel([
        Animated.timing(brandOp, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(brandY, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(formOp, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(formY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e.message ?? "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const pressIn = () =>
    Animated.spring(btnScale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  const pressOut = () =>
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 3,
    }).start();

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={s.flex}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Brand ── */}
          <Animated.View
            style={[
              s.brand,
              { opacity: brandOp, transform: [{ translateY: brandY }] },
            ]}
          >
            <View style={s.logoCard}>
              <Image
                source={require("../../assets/logo.png")}
                style={s.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={s.brandSub}>POS SYSTEM</Text>
          </Animated.View>

          {/* ── Form ── */}
          <Animated.View
            style={[
              s.form,
              { opacity: formOp, transform: [{ translateY: formY }] },
            ]}
          >
            <View style={s.formHead}>
              <Text style={s.formTitle}>Welcome back</Text>
              <Text style={s.formSub}>Sign in to your account</Text>
            </View>

            <View style={s.fields}>
              <Input
                label="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoComplete="email"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            {error ? (
              <View style={s.errWrap}>
                <Ionicons name="alert-circle-outline" size={13} color={C.err} />
                <Text style={s.errText}>{error}</Text>
              </View>
            ) : null}

            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={[s.btn, loading && s.btnBusy]}
                onPress={handleLogin}
                onPressIn={pressIn}
                onPressOut={pressOut}
                activeOpacity={1}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={C.bg} size="small" />
                ) : (
                  <Text style={s.btnText}>SIGN IN</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* ── Footer ── */}
          <View style={s.footer}>
            <View style={s.footerLine} />
            <Text style={s.footerText}>© 2026 Ambel · All rights reserved</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 36,
    paddingTop: 60,
    paddingBottom: 36,
    justifyContent: "space-between",
  },

  // Brand
  brand: {
    alignItems: "center",
    gap: 14,
    marginBottom: 52,
  },
  logoCard: {
    width: 136,
    height: 136,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    shadowColor: "#C4A882",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 10,
  },
  logoImg: {
    width: 104,
    height: 104,
  },
  brandSub: {
    fontSize: 9,
    letterSpacing: 4.5,
    color: C.textSub,
    fontWeight: "500",
    marginLeft: 4,
  },

  // Form
  form: { gap: 32 },
  formHead: { gap: 6 },
  formTitle: {
    fontSize: 26,
    fontWeight: "300",
    color: C.text,
    letterSpacing: -0.3,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif" }),
  },
  formSub: {
    fontSize: 13,
    color: C.textSub,
    fontWeight: "400",
    letterSpacing: 0.1,
  },
  fields: { gap: 30 },

  // Input
  inputWrap: {
    position: "relative",
    height: 54,
    justifyContent: "flex-end",
  },
  inputLabel: {
    position: "absolute",
    left: 0,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  inputField: {
    height: 34,
    fontSize: 15,
    color: C.text,
    paddingBottom: 6,
    paddingRight: 30,
    letterSpacing: 0.2,
  },
  inputLine: {
    height: StyleSheet.hairlineWidth,
  },
  eyeBtn: {
    position: "absolute",
    right: 0,
    bottom: 10,
  },

  // Error
  errWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.errBg,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.errBorder,
    marginTop: -8,
  },
  errText: {
    fontSize: 13,
    color: C.err,
    fontWeight: "400",
    flex: 1,
  },

  // Button
  btn: {
    backgroundColor: C.text,
    height: 52,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  btnBusy: { opacity: 0.65 },
  btnText: {
    color: C.bg,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3.5,
  },

  // Footer
  footer: {
    alignItems: "center",
    gap: 12,
    marginTop: 48,
  },
  footerLine: {
    width: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.textMuted,
  },
  footerText: {
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 0.3,
  },
});
