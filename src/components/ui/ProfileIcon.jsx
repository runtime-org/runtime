import React, { forwardRef } from 'react';

const ProfileIcon = forwardRef(({ username = "User", className = "" }, ref) => {
  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : "US";
  
  return (
    <div 
      ref={ref}
      className={`flex items-center justify-center w-6 h-6 hover:cursor-pointer mr-1 
                rounded-full bg-white text-black text-xs font-medium ${className}`}
    >
      {initials}
    </div>
  );
});

export default ProfileIcon; 