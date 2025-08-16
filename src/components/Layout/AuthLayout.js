import React from 'react';
import Logo from '../Logo/Logo';

const AuthLayout = ({ children }) => {
  return (
    <div
      className="
        min-h-screen w-full
        grid grid-cols-1
        lg:grid-cols-[1fr_minmax(26rem,42rem)]
        bg-primary-50
      "
    >
      <section
        className="
          relative hidden lg:flex items-center justify-center px-12
          overflow-hidden
          bg-gradient-to-br from-primary-300 to-primary-700
        "
      >
        <div className="absolute inset-0 pointer-events-none opacity-15" />
        <div className="w-full max-w-2xl text-white">
          <div className="flex items-center gap-3 mb-8">
            <Logo width={180} height={56} />
          </div>

          <p className="text-white/80 mb-10">
            Intelligent AI Agents for Your Business
          </p>

          <h1 className="text-5xl font-extrabold leading-tight">Welcome to SpeakAI</h1>
          <p className="mt-6 text-lg leading-8 text-white/95">
            Available 24/7 to enhance customer experience and drive growth.
          </p>
        </div>

        <div className="pointer-events-none absolute inset-0">
          <span className="absolute -right-6 top-24 rounded-2xl opacity-40 w-[120px] h-[72px] rotate-[18deg] bg-gradient-to-r from-primary-400 to-primary-900" />
          <span className="absolute left-20 bottom-24 rounded-2xl opacity-35 w-[96px] h-[56px] -rotate-[16deg] bg-gradient-to-r from-primary-300 to-primary-800" />
          <span className="absolute right-28 bottom-40 rounded-2xl opacity-30 w-[80px] h-[48px] rotate-[30deg] bg-gradient-to-r from-primary-300 to-primary-500" />
        </div>
      </section>

      <main className="bg-white flex items-center justify-center px-6 sm:px-10">
        <div className="w-full max-w-md">
          {children}
          <p className="mt-10 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Devstrix. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
