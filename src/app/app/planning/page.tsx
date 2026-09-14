"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Repeat, Target } from "lucide-react";
import BudgetsPage from "@/app/app/budgets/page";
import SubscriptionsPage from "@/app/app/subscriptions/page";
import EventsPage from "@/app/app/events/page";

export default function PlanningPage() {
    const [activeTab, setActiveTab] = React.useState("subscriptions");

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">Planning</h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                    Plan spending, monthly bills, loan payments, borrowed money, and event budgets in one place.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
                <div className="sticky top-3 z-10 -mx-1 px-1 sm:static sm:mx-0 sm:px-0">
                    <TabsList className="grid w-full grid-cols-3 shadow-sm sm:max-w-lg">
                        <TabsTrigger value="subscriptions" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm">
                            <Repeat className="h-4 w-4" />
                            <span className="sm:hidden">Bills</span>
                            <span className="hidden sm:inline">Bills & Loans</span>
                        </TabsTrigger>
                        <TabsTrigger value="budgets" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm">
                            <Target className="h-4 w-4" />
                            Budgets
                        </TabsTrigger>
                        <TabsTrigger value="events" className="gap-1.5 px-2 text-xs sm:gap-2 sm:px-4 sm:text-sm">
                            <Calendar className="h-4 w-4" />
                            Events
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="subscriptions" className="mt-0 space-y-4 sm:space-y-6">
                    {activeTab === "subscriptions" && <SubscriptionsPage embedded />}
                </TabsContent>

                <TabsContent value="budgets" className="mt-0 space-y-4 sm:space-y-6">
                    {activeTab === "budgets" && <BudgetsPage embedded />}
                </TabsContent>

                <TabsContent value="events" className="mt-0 space-y-4 sm:space-y-6">
                    {activeTab === "events" && <EventsPage embedded />}
                </TabsContent>
            </Tabs>
        </div>
    );
}
