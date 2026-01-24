"use client";

import * as React from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Target, Repeat, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PlanningPage() {
    const [activeTab, setActiveTab] = React.useState("budgets");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Planning</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your budgets and subscriptions in one place
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="budgets" className="gap-2">
                        <Target className="h-4 w-4" />
                        Budgets
                    </TabsTrigger>
                    <TabsTrigger value="subscriptions" className="gap-2">
                        <Repeat className="h-4 w-4" />
                        Subscriptions
                    </TabsTrigger>
                </TabsList>

                {/* Budgets Tab */}
                <TabsContent value="budgets" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Target className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>Budget Management</CardTitle>
                                    <CardDescription>Track spending limits and manage your monthly budgets</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <Target className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Budget Section</h3>
                                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                                    Set spending limits for different categories and track your progress throughout the month.
                                </p>
                                <Button asChild>
                                    <Link href="/app/budgets">
                                        Go to Budgets
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Subscriptions Tab */}
                <TabsContent value="subscriptions" className="space-y-6 mt-0">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Repeat className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle>Subscription Management</CardTitle>
                                    <CardDescription>Track recurring expenses and never miss a payment</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <Repeat className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Subscriptions Section</h3>
                                <p className="text-sm text-muted-foreground mb-6 max-w-md">
                                    Monitor your recurring payments and stay on top of subscription renewals.
                                </p>
                                <Button asChild>
                                    <Link href="/app/subscriptions">
                                        Go to Subscriptions
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Quick Stats / Info Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Target className="h-4 w-4 text-blue-600" />
                            </div>
                            <CardTitle className="text-base">About Budgets</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Set monthly spending limits for overall expenses or specific categories. Track your progress and get alerts when approaching limits.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                                <Repeat className="h-4 w-4 text-purple-600" />
                            </div>
                            <CardTitle className="text-base">About Subscriptions</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            Monitor recurring payments like Netflix, Spotify, or gym memberships. Get reminders for upcoming payments and track total monthly costs.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
