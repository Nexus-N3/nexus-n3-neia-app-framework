type TemplateHeaderProps = {
  siteLabel: string;
};

export default function TemplateHeader({ siteLabel }: TemplateHeaderProps) {
  return (
    <div className="header">
      <h2>NEIA React App Template{siteLabel ? ` - connected to ${siteLabel}` : ""}</h2>
      <p className="hint">This template mirrors the vanilla flow but uses React and components.</p>
    </div>
  );
}
