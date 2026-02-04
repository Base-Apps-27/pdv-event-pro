import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function LiveViewSkeleton() {
  return (
    <div className="min-h-screen bg-[#F0F1F3]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Navigation Bar Skeleton */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="bg-gray-200 p-1 rounded-xl flex shrink-0 shadow-inner w-full sm:w-auto h-12 sm:h-auto">
            <Skeleton className="h-10 w-1/2 sm:w-24 rounded-lg bg-white/50" />
            <Skeleton className="h-10 w-1/2 sm:w-24 rounded-lg ml-1" />
          </div>
          <div className="flex-1 w-full">
            <Skeleton className="h-12 w-full rounded-md border-2 border-gray-200" />
          </div>
        </div>

        {/* Event Info Skeleton */}
        <div className="flex flex-col gap-2 mt-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-3/4 sm:w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>

        {/* Status Card Skeleton */}
        <Card className="bg-white border-2 border-gray-300 overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200 p-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
            <div className="space-y-3 md:border-l md:pl-6 border-gray-100">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>

        {/* Session List Skeleton */}
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200 space-y-3">
                <div className="flex justify-between">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="p-4 space-y-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex gap-4">
                    <div className="w-16 space-y-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}