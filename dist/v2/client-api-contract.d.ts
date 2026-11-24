import { z } from "zod";
export declare const ClientAttachmentSchema: z.ZodObject<{
    instanceID: z.ZodString;
    generation: z.ZodString;
}, z.core.$strict>;
export type ClientAttachment = z.infer<typeof ClientAttachmentSchema>;
export declare const ClientGoalSchema: z.ZodObject<{
    id: z.ZodString;
    sessionID: z.ZodString;
    objective: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        blocked: "blocked";
        budgetLimited: "budgetLimited";
        complete: "complete";
        paused: "paused";
    }>;
    tokensUsed: z.ZodNumber;
    tokenBudget: z.ZodOptional<z.ZodNumber>;
    turnsUsed: z.ZodNumber;
    timeUsedSeconds: z.ZodNumber;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
    completedAt: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type ClientApiGoal = z.infer<typeof ClientGoalSchema>;
export declare const ClientApiStateSchema: z.ZodObject<{
    instanceID: z.ZodString;
    revision: z.ZodNumber;
    directory: z.ZodString;
    tasks: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        agent: z.ZodString;
        status: z.ZodString;
        sessionID: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        startedAt: z.ZodOptional<z.ZodNumber>;
        completedAt: z.ZodOptional<z.ZodNumber>;
        error: z.ZodOptional<z.ZodString>;
        toolCalls: z.ZodOptional<z.ZodNumber>;
        lastTool: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        attempts: z.ZodOptional<z.ZodArray<z.ZodObject<{
            number: z.ZodNumber;
            status: z.ZodString;
            sessionID: z.ZodOptional<z.ZodString>;
            model: z.ZodOptional<z.ZodString>;
            error: z.ZodOptional<z.ZodString>;
            startedAt: z.ZodOptional<z.ZodNumber>;
            completedAt: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>>;
    goals: z.ZodRecord<z.ZodString, z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        objective: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            blocked: "blocked";
            budgetLimited: "budgetLimited";
            complete: "complete";
            paused: "paused";
        }>;
        tokensUsed: z.ZodNumber;
        tokenBudget: z.ZodOptional<z.ZodNumber>;
        turnsUsed: z.ZodNumber;
        timeUsedSeconds: z.ZodNumber;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        completedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    plans: z.ZodRecord<z.ZodString, z.ZodObject<{
        workId: z.ZodString;
        planName: z.ZodString;
        planPath: z.ZodString;
        status: z.ZodString;
        total: z.ZodNumber;
        completed: z.ZodNumber;
        nextTask: z.ZodOptional<z.ZodString>;
        startedAt: z.ZodOptional<z.ZodNumber>;
        tasks: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            title: z.ZodString;
            status: z.ZodString;
            sessionID: z.ZodString;
            agent: z.ZodOptional<z.ZodString>;
            category: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    teams: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
        teamRunId: z.ZodString;
        teamName: z.ZodString;
        status: z.ZodString;
        members: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            sessionID: z.ZodOptional<z.ZodString>;
            status: z.ZodString;
            agentType: z.ZodString;
            unread: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    health: z.ZodObject<{
        categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
        providers: z.ZodArray<z.ZodObject<{
            provider: z.ZodString;
            failures: z.ZodNumber;
            lastError: z.ZodString;
            lastModel: z.ZodString;
            lastAt: z.ZodNumber;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ClientApiState = z.infer<typeof ClientApiStateSchema>;
declare const failure: z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodEnum<{
            client_conflict: "client_conflict";
            goal_changed: "goal_changed";
            not_found: "not_found";
            stale_attachment: "stale_attachment";
            unsupported: "unsupported";
            wrong_location: "wrong_location";
        }>;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type ClientApiFailure = z.infer<typeof failure>;
export declare const ClientGoalControlSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    attachment: z.ZodOptional<z.ZodObject<{
        instanceID: z.ZodString;
        generation: z.ZodString;
    }, z.core.$strict>>;
    action: z.ZodLiteral<"clear">;
    sessionID: z.ZodString;
    expectedGoalID: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    attachment: z.ZodOptional<z.ZodObject<{
        instanceID: z.ZodString;
        generation: z.ZodString;
    }, z.core.$strict>>;
    action: z.ZodLiteral<"update">;
    sessionID: z.ZodString;
    expectedGoalID: z.ZodString;
    objective: z.ZodOptional<z.ZodString>;
    tokenBudget: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        complete: "complete";
        paused: "paused";
    }>>;
}, z.core.$strict>], "action">;
export type ClientGoalControl = z.infer<typeof ClientGoalControlSchema>;
declare const goalResult: z.ZodUnion<readonly [z.ZodObject<{
    ok: z.ZodLiteral<true>;
    goal: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        sessionID: z.ZodString;
        objective: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            blocked: "blocked";
            budgetLimited: "budgetLimited";
            complete: "complete";
            paused: "paused";
        }>;
        tokensUsed: z.ZodNumber;
        tokenBudget: z.ZodOptional<z.ZodNumber>;
        turnsUsed: z.ZodNumber;
        timeUsedSeconds: z.ZodNumber;
        createdAt: z.ZodNumber;
        updatedAt: z.ZodNumber;
        completedAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    ok: z.ZodLiteral<false>;
    error: z.ZodObject<{
        code: z.ZodEnum<{
            client_conflict: "client_conflict";
            goal_changed: "goal_changed";
            not_found: "not_found";
            stale_attachment: "stale_attachment";
            unsupported: "unsupported";
            wrong_location: "wrong_location";
        }>;
        message: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>]>;
export type ClientGoalControlResult = z.infer<typeof goalResult>;
/** Portable Standard Schema definition: consumers bundle this file without the engine. */
export declare const clientRpc: {
    readonly id: "omo.client.v1";
    readonly methods: {
        readonly describe: {
            readonly input: z.ZodObject<{}, z.core.$strict>;
            readonly output: z.ZodObject<{
                version: z.ZodLiteral<1>;
                instanceID: z.ZodString;
                directory: z.ZodString;
                capabilities: z.ZodObject<{
                    goals: z.ZodBoolean;
                    tasks: z.ZodBoolean;
                    presentation: z.ZodLiteral<true>;
                }, z.core.$strip>;
                client: z.ZodNullable<z.ZodObject<{
                    clientID: z.ZodString;
                    attachment: z.ZodObject<{
                        instanceID: z.ZodString;
                        generation: z.ZodString;
                    }, z.core.$strict>;
                    presentation: z.ZodObject<{
                        surface: z.ZodEnum<{
                            chat: "chat";
                            terminal: "terminal";
                        }>;
                    }, z.core.$strict>;
                }, z.core.$strip>>;
            }, z.core.$strip>;
        };
        readonly getState: {
            readonly input: z.ZodObject<{
                sessionID: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>;
            readonly output: z.ZodObject<{
                instanceID: z.ZodString;
                revision: z.ZodNumber;
                directory: z.ZodString;
                tasks: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
                    id: z.ZodString;
                    description: z.ZodString;
                    agent: z.ZodString;
                    status: z.ZodString;
                    sessionID: z.ZodOptional<z.ZodString>;
                    category: z.ZodOptional<z.ZodString>;
                    startedAt: z.ZodOptional<z.ZodNumber>;
                    completedAt: z.ZodOptional<z.ZodNumber>;
                    error: z.ZodOptional<z.ZodString>;
                    toolCalls: z.ZodOptional<z.ZodNumber>;
                    lastTool: z.ZodOptional<z.ZodString>;
                    model: z.ZodOptional<z.ZodString>;
                    attempts: z.ZodOptional<z.ZodArray<z.ZodObject<{
                        number: z.ZodNumber;
                        status: z.ZodString;
                        sessionID: z.ZodOptional<z.ZodString>;
                        model: z.ZodOptional<z.ZodString>;
                        error: z.ZodOptional<z.ZodString>;
                        startedAt: z.ZodOptional<z.ZodNumber>;
                        completedAt: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$strip>>>;
                }, z.core.$strip>>>;
                goals: z.ZodRecord<z.ZodString, z.ZodObject<{
                    id: z.ZodString;
                    sessionID: z.ZodString;
                    objective: z.ZodString;
                    status: z.ZodEnum<{
                        active: "active";
                        blocked: "blocked";
                        budgetLimited: "budgetLimited";
                        complete: "complete";
                        paused: "paused";
                    }>;
                    tokensUsed: z.ZodNumber;
                    tokenBudget: z.ZodOptional<z.ZodNumber>;
                    turnsUsed: z.ZodNumber;
                    timeUsedSeconds: z.ZodNumber;
                    createdAt: z.ZodNumber;
                    updatedAt: z.ZodNumber;
                    completedAt: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
                plans: z.ZodRecord<z.ZodString, z.ZodObject<{
                    workId: z.ZodString;
                    planName: z.ZodString;
                    planPath: z.ZodString;
                    status: z.ZodString;
                    total: z.ZodNumber;
                    completed: z.ZodNumber;
                    nextTask: z.ZodOptional<z.ZodString>;
                    startedAt: z.ZodOptional<z.ZodNumber>;
                    tasks: z.ZodArray<z.ZodObject<{
                        key: z.ZodString;
                        label: z.ZodString;
                        title: z.ZodString;
                        status: z.ZodString;
                        sessionID: z.ZodString;
                        agent: z.ZodOptional<z.ZodString>;
                        category: z.ZodOptional<z.ZodString>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>;
                teams: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodObject<{
                    teamRunId: z.ZodString;
                    teamName: z.ZodString;
                    status: z.ZodString;
                    members: z.ZodArray<z.ZodObject<{
                        name: z.ZodString;
                        sessionID: z.ZodOptional<z.ZodString>;
                        status: z.ZodString;
                        agentType: z.ZodString;
                        unread: z.ZodOptional<z.ZodNumber>;
                    }, z.core.$strip>>;
                }, z.core.$strip>>>;
                health: z.ZodObject<{
                    categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString>>;
                    providers: z.ZodArray<z.ZodObject<{
                        provider: z.ZodString;
                        failures: z.ZodNumber;
                        lastError: z.ZodString;
                        lastModel: z.ZodString;
                        lastAt: z.ZodNumber;
                    }, z.core.$strip>>;
                }, z.core.$strip>;
            }, z.core.$strip>;
        };
        readonly controlGoal: {
            readonly input: z.ZodDiscriminatedUnion<[z.ZodObject<{
                attachment: z.ZodOptional<z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>>;
                action: z.ZodLiteral<"clear">;
                sessionID: z.ZodString;
                expectedGoalID: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                attachment: z.ZodOptional<z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>>;
                action: z.ZodLiteral<"update">;
                sessionID: z.ZodString;
                expectedGoalID: z.ZodString;
                objective: z.ZodOptional<z.ZodString>;
                tokenBudget: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
                status: z.ZodOptional<z.ZodEnum<{
                    active: "active";
                    complete: "complete";
                    paused: "paused";
                }>>;
            }, z.core.$strict>], "action">;
            readonly output: z.ZodUnion<readonly [z.ZodObject<{
                ok: z.ZodLiteral<true>;
                goal: z.ZodNullable<z.ZodObject<{
                    id: z.ZodString;
                    sessionID: z.ZodString;
                    objective: z.ZodString;
                    status: z.ZodEnum<{
                        active: "active";
                        blocked: "blocked";
                        budgetLimited: "budgetLimited";
                        complete: "complete";
                        paused: "paused";
                    }>;
                    tokensUsed: z.ZodNumber;
                    tokenBudget: z.ZodOptional<z.ZodNumber>;
                    turnsUsed: z.ZodNumber;
                    timeUsedSeconds: z.ZodNumber;
                    createdAt: z.ZodNumber;
                    updatedAt: z.ZodNumber;
                    completedAt: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strip>>;
            }, z.core.$strip>, z.ZodObject<{
                ok: z.ZodLiteral<false>;
                error: z.ZodObject<{
                    code: z.ZodEnum<{
                        client_conflict: "client_conflict";
                        goal_changed: "goal_changed";
                        not_found: "not_found";
                        stale_attachment: "stale_attachment";
                        unsupported: "unsupported";
                        wrong_location: "wrong_location";
                    }>;
                    message: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>]>;
        };
        readonly controlTask: {
            readonly input: z.ZodDiscriminatedUnion<[z.ZodObject<{
                attachment: z.ZodOptional<z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>>;
                action: z.ZodLiteral<"cancel">;
                taskId: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                attachment: z.ZodOptional<z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>>;
                action: z.ZodLiteral<"retry">;
                taskId: z.ZodString;
                model: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "action">;
            readonly output: z.ZodUnion<readonly [z.ZodObject<{
                ok: z.ZodLiteral<true>;
                message: z.ZodString;
            }, z.core.$strip>, z.ZodObject<{
                ok: z.ZodLiteral<false>;
                error: z.ZodObject<{
                    code: z.ZodEnum<{
                        client_conflict: "client_conflict";
                        goal_changed: "goal_changed";
                        not_found: "not_found";
                        stale_attachment: "stale_attachment";
                        unsupported: "unsupported";
                        wrong_location: "wrong_location";
                    }>;
                    message: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>]>;
        };
        readonly attach: {
            readonly input: z.ZodObject<{
                instanceID: z.ZodString;
                clientID: z.ZodString;
                callbackRPCID: z.ZodString;
                presentation: z.ZodObject<{
                    surface: z.ZodEnum<{
                        chat: "chat";
                        terminal: "terminal";
                    }>;
                }, z.core.$strict>;
            }, z.core.$strict>;
            readonly output: z.ZodUnion<readonly [z.ZodObject<{
                ok: z.ZodLiteral<true>;
                attachment: z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>;
            }, z.core.$strip>, z.ZodObject<{
                ok: z.ZodLiteral<false>;
                error: z.ZodObject<{
                    code: z.ZodEnum<{
                        client_conflict: "client_conflict";
                        goal_changed: "goal_changed";
                        not_found: "not_found";
                        stale_attachment: "stale_attachment";
                        unsupported: "unsupported";
                        wrong_location: "wrong_location";
                    }>;
                    message: z.ZodString;
                }, z.core.$strip>;
            }, z.core.$strip>]>;
        };
        readonly detach: {
            readonly input: z.ZodObject<{
                instanceID: z.ZodString;
                generation: z.ZodString;
            }, z.core.$strict>;
            readonly output: z.ZodObject<{
                detached: z.ZodBoolean;
            }, z.core.$strip>;
        };
    };
    readonly events: {
        readonly ready: {
            readonly schema: z.ZodObject<{
                instanceID: z.ZodString;
                revision: z.ZodNumber;
            }, z.core.$strip>;
        };
        readonly stateChanged: {
            readonly schema: z.ZodObject<{
                instanceID: z.ZodString;
                revision: z.ZodNumber;
            }, z.core.$strip>;
        };
    };
};
export declare const continuationRpc: (id: string) => {
    readonly id: string;
    readonly methods: {
        readonly beforeGoalContinuation: {
            readonly input: z.ZodObject<{
                attachment: z.ZodObject<{
                    instanceID: z.ZodString;
                    generation: z.ZodString;
                }, z.core.$strict>;
                sessionID: z.ZodString;
                expectedGoalID: z.ZodString;
            }, z.core.$strict>;
            readonly output: z.ZodObject<{
                synchronized: z.ZodLiteral<true>;
            }, z.core.$strip>;
        };
    };
    readonly events: {};
};
export {};
