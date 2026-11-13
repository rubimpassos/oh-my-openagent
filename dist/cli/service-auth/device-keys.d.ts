export declare function generateDeviceKeys(): {
    public: {
        signingKey: string;
        sealingKey: string;
    };
    private: {
        signingPrivateKey: string;
        sealingPrivateKey: string;
    };
};
