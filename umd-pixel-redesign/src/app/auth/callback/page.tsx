"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { functions, auth } from "@/lib/firebase";

export default function AuthCallback() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState("Processing login...");
    const [error, setError] = useState("");

    useEffect(() => {
        const code = searchParams.get("code");
        const errorParam = searchParams.get("error");

        if (errorParam) {
            setError(`Slack Login Error: ${errorParam}`);
            return;
        }

        if (!code) {
            setError("No authorization code found.");
            return;
        }

        const exchangeCode = async () => {
            try {
                setStatus("Exchanging code for token...");
                const authWithSlack = httpsCallable(functions, "authWithSlack");

                // Note: redirectUri must match exactly what was sent in the authorize step
                const result = await authWithSlack({
                    code,
                    redirectUri: "http://localhost:3000/auth/callback"
                });

                const { token } = result.data as { token: string };

                setStatus("Signing in...");
                await signInWithCustomToken(auth, token);

                setStatus("Success! Redirecting...");
                router.push("/");
            } catch (err: unknown) {
                console.error("Login failed", err);
                const errorMessage = err instanceof Error ? err.message : "Authentication failed";
                setError(errorMessage);
            }
        };

        exchangeCode();
    }, [searchParams, router]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <div className="bg-white p-8 rounded-lg shadow-md text-center">
                    <h1 className="text-xl font-bold text-red-600 mb-4">Login Failed</h1>
                    <p className="text-gray-700">{error}</p>
                    <button
                        onClick={() => router.push("/login")}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">{status}</p>
            </div>
        </div>
    );
}
