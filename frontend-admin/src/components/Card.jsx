import React from 'react';

export function Card({ title, children, className = "" }) {
  return (
    <section className={`card ${className}`.trim()}>
      <div className="card-head">
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function HelperText({ text }) {
  return <p className="helper-text">{text}</p>;
}
