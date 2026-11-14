"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Repeat, Target } from "@/components/icons";
import BudgetsPage from "@/app/app/budgets/page";
import SubscriptionsPage from "@/app/app/subscriptions/page";

export default function PlanningPage() {
    const [activeTab, setActiveTab] = React.useState("budgets");

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <p className="sn-eye">Budgets and bills</p>
          <h1 className="sn-head mt-1.5">Planning<span className="sn-dot">.</span></h1>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
                    Plan spending, monthly bills, loan payments, and borrowed money in one place.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
                <div className="sticky top-3 z-10 -mx-1 px-1 sm:static sm:mx-0 sm:px-0">
                    <TabsList className="grid w-full grid-cols-2 sm:max-w-md">
                        <TabsTrigger value="budgets" className="gap-2">
                            <Target className="h-4 w-4" />
                            Budgets
                        </TabsTrigger>
                        <TabsTrigger value="subscriptions" className="gap-2">
                            <Repeat className="h-4 w-4" />
                            Bills & Loans
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="budgets" className="mt-0 space-y-4 sm:space-y-6">
                    {activeTab === "budgets" && <BudgetsPage embedded />}
                </TabsContent>

                <TabsContent value="subscriptions" className="mt-0 space-y-4 sm:space-y-6">
                    {activeTab === "subscriptions" && <SubscriptionsPage embedded />}
                </TabsContent>
            </Tabs>
        </div>
    );
}
