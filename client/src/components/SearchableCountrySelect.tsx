import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES, searchCountries } from "@/lib/countries";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SearchableCountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableCountrySelect({ value, onChange, placeholder }: SearchableCountrySelectProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const filtered = searchCountries(search);

  return (
    <Select value={value} onValueChange={onChange} open={isOpen} onOpenChange={setIsOpen}>
      <SelectTrigger data-testid="select-country">
        <SelectValue placeholder={placeholder || "Country"} />
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 border-b" onClick={e => e.stopPropagation()}>
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8"
            data-testid="input-country-search"
          />
        </div>
        <ScrollArea className="h-64 w-full">
          {filtered.length > 0 ? (
            filtered.map(country => (
              <SelectItem key={country} value={country}>
                {country}
              </SelectItem>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">No countries found</div>
          )}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}
