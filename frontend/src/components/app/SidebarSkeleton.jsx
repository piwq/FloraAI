import React from 'react';

const SkeletonItem = () => (
  <div className="flex items-center w-full px-4 py-2.5">
    <div className="w-4 h-4 bg-surface-1 rounded mr-3 flex-shrink-0"></div>
    <div className="w-full h-4 bg-surface-1 rounded"></div>
  </div>
);

export const SidebarSkeleton = () => {
  return (
    <div className="animate-pulse space-y-1">
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
    </div>
  );
};