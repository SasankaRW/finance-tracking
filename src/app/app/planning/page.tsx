"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Repeat, Target } from "lucide-react";
import BudgetsPage from "@/app/app/budgets/page";
import SubscriptionsPage from "@/app/app/subscriptions/page";
import EventsPage from "@/app/app/events/page";
import { iosIn } from "@/lib/motion/variants";

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

                {/* Deliberately not Radix TabsContent here: it unmounts inactive
                    panels itself (Presence present={isSelected}, no CSS animation
                    on that node for it to wait on), so a nested AnimatePresence
                    never gets a chance to run its exit — the whole subtree is
                    yanked in the same commit the tab changes. Driving the swap
                    directly off activeTab is what actually lets exit play. */}
                <AnimatePresence mode="wait">
                    {activeTab === "subscriptions" && (
                        <motion.div
                            key="subscriptions"
                            role="tabpanel"
                            variants={iosIn}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4 sm:space-y-6"
                        >
                            <SubscriptionsPage embedded />
                        </motion.div>
                    )}
                    {activeTab === "budgets" && (
                        <motion.div
                            key="budgets"
                            role="tabpanel"
                            variants={iosIn}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4 sm:space-y-6"
                        >
                            <BudgetsPage embedded />
                        </motion.div>
                    )}
                    {activeTab === "events" && (
                        <motion.div
                            key="events"
                            role="tabpanel"
                            variants={iosIn}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4 sm:space-y-6"
                        >
                            <EventsPage embedded />
                        </motion.div>
                    )}
                </AnimatePresence>
            </Tabs>
        </div>
    );
}
